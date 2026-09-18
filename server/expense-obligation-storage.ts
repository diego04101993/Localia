import crypto from "node:crypto";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  auditLogs,
  branchCommercialProjects,
  branchExpenseObligationPayments,
  branchExpenseObligations,
  branchFinanceEntries,
  branchSuppliers,
  type BranchExpenseObligation,
  type BranchExpenseObligationPayment,
} from "@shared/schema";
import {
  computeExpenseObligationTax,
  assertExpenseDocumentUnpaid,
  assertExpensePaymentAllowed,
  expenseCentsToMoney,
  expenseMoneyToCents,
  EXPENSE_OBLIGATION_PAYMENT_METHODS,
  normalizeExpenseOperationKey,
  normalizeExpenseText,
  serializeExpenseCreate,
  serializeExpensePayment,
  type ExpenseObligationTaxMode,
  type ExpensePaymentCanonicalInput,
} from "@shared/expense-obligation";

type ExpenseTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const PAYMENT_SOURCE = "expense_obligation_payment";

export class ExpenseObligationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ExpenseObligationError";
  }
}

function reject(code: string): never {
  throw new ExpenseObligationError(code);
}

function hash(payload: string): string {
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function paymentMethod(value: string): string {
  const method = value.trim().toLowerCase();
  if (!(EXPENSE_OBLIGATION_PAYMENT_METHODS as readonly string[]).includes(method)) {
    reject("EXPENSE_PAYMENT_METHOD_INVALID");
  }
  return method;
}

export type ExpensePaymentInput = {
  operationKey: string;
  amount: string;
  paymentMethod: string;
  entryDate: string;
  reference?: string | null;
  notes?: string | null;
};

export type ExpenseDocumentInput = {
  projectId?: string | null;
  supplierId?: string | null;
  beneficiaryName?: string | null;
  concept: string;
  category?: string | null;
  documentReference?: string | null;
  issueDate: string;
  dueDate?: string | null;
  notes?: string | null;
  documentStatus: "draft" | "open";
  subtotalAmount: string;
  discountAmount: string;
  taxMode: ExpenseObligationTaxMode;
  taxRate: string;
};

async function lockOperation(tx: ExpenseTx, branchId: string, family: string, key: string) {
  await tx.execute(sql`SET LOCAL statement_timeout = '20s'`);
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${branchId}), hashtext(${`${family}:${key}`}))
  `);
}

async function lockDocument(tx: ExpenseTx, branchId: string, id: string) {
  const [document] = await tx.select().from(branchExpenseObligations)
    .where(and(eq(branchExpenseObligations.branchId, branchId), eq(branchExpenseObligations.id, id)))
    .for("update").limit(1);
  if (!document) reject("EXPENSE_DOCUMENT_NOT_FOUND");
  return document;
}

async function paidCents(tx: ExpenseTx, branchId: string, id: string): Promise<bigint> {
  const [row] = await tx.select({ total: sql<string>`COALESCE(SUM(${branchExpenseObligationPayments.amount}), 0)` })
    .from(branchExpenseObligationPayments)
    .where(and(eq(branchExpenseObligationPayments.branchId, branchId), eq(branchExpenseObligationPayments.obligationId, id)));
  return expenseMoneyToCents(String(row?.total ?? "0"));
}

async function assertProject(tx: ExpenseTx, branchId: string, projectId: string | null) {
  if (!projectId) return;
  const [project] = await tx.select({ status: branchCommercialProjects.status })
    .from(branchCommercialProjects)
    .where(and(eq(branchCommercialProjects.branchId, branchId), eq(branchCommercialProjects.id, projectId), isNull(branchCommercialProjects.deletedAt)))
    .limit(1);
  if (!project || ["completed", "cancelled", "archived"].includes(project.status)) {
    reject("EXPENSE_PROJECT_INVALID");
  }
}

async function resolveBeneficiary(tx: ExpenseTx, branchId: string, supplierId: string | null, manualName: string | null) {
  if (supplierId) {
    const [supplier] = await tx.select({ name: branchSuppliers.name })
      .from(branchSuppliers)
      .where(and(eq(branchSuppliers.branchId, branchId), eq(branchSuppliers.id, supplierId), eq(branchSuppliers.isActive, true), isNull(branchSuppliers.deletedAt)))
      .limit(1);
    if (!supplier) reject("EXPENSE_SUPPLIER_INVALID");
    return normalizeExpenseText(supplier.name)!;
  }
  if (!manualName || manualName.length > 160) reject("EXPENSE_BENEFICIARY_REQUIRED");
  return manualName;
}

function validateDocument(input: ExpenseDocumentInput) {
  const concept = normalizeExpenseText(input.concept);
  const manualName = normalizeExpenseText(input.beneficiaryName);
  if (!concept || concept.length > 160) reject("EXPENSE_CONCEPT_INVALID");
  const tax = computeExpenseObligationTax(input);
  return {
    concept,
    manualName,
    projectId: input.projectId?.trim() || null,
    supplierId: input.supplierId?.trim() || null,
    category: normalizeExpenseText(input.category),
    documentReference: normalizeExpenseText(input.documentReference),
    notes: normalizeExpenseText(input.notes),
    dueDate: input.dueDate || null,
    tax,
  };
}

async function audit(tx: ExpenseTx, actorUserId: string, branchId: string, action: string, metadata: Record<string, unknown>) {
  await tx.insert(auditLogs).values({ actorUserId, branchId, action, metadata });
}

async function verifyPaymentLink(tx: ExpenseTx, branchId: string, payment: BranchExpenseObligationPayment) {
  const [entry] = await tx.select({ id: branchFinanceEntries.id }).from(branchFinanceEntries)
    .where(and(
      eq(branchFinanceEntries.branchId, branchId), eq(branchFinanceEntries.id, payment.financeEntryId),
      eq(branchFinanceEntries.type, "expense"), eq(branchFinanceEntries.source, PAYMENT_SOURCE),
      eq(branchFinanceEntries.sourceId, payment.id), isNull(branchFinanceEntries.deletedAt),
    )).limit(1);
  if (!entry) reject("EXPENSE_INCOMPLETE_REPLAY");
}

async function insertPayment(tx: ExpenseTx, input: {
  branchId: string;
  actorUserId: string;
  document: BranchExpenseObligation;
  key: string;
  fingerprint: string;
  amount: string;
  method: string;
  entryDate: string;
  reference: string | null;
  notes: string | null;
}) {
  const paymentId = crypto.randomUUID();
  const [entry] = await tx.insert(branchFinanceEntries).values({
    branchId: input.branchId,
    projectId: null,
    type: "expense",
    category: input.document.category ?? "otros_gastos",
    concept: `${input.document.beneficiaryNameSnapshot} · ${input.document.concept}`,
    amount: input.amount,
    paymentMethod: input.method,
    clientUserId: null,
    clientName: null,
    notes: input.notes,
    entryDate: input.entryDate,
    source: PAYMENT_SOURCE,
    sourceId: paymentId,
    metadata: { obligationId: input.document.id, documentReference: input.document.documentReference },
    createdBy: input.actorUserId,
  }).returning({ id: branchFinanceEntries.id });
  const [payment] = await tx.insert(branchExpenseObligationPayments).values({
    id: paymentId,
    branchId: input.branchId,
    obligationId: input.document.id,
    idempotencyKey: input.key,
    idempotencyFingerprint: input.fingerprint,
    amount: input.amount,
    paymentMethod: input.method,
    entryDate: input.entryDate,
    reference: input.reference,
    notes: input.notes,
    financeEntryId: entry.id,
    createdBy: input.actorUserId,
  }).returning();
  return payment;
}

export async function createExpenseObligation(input: {
  branchId: string;
  actorUserId: string;
  operationKey: string;
  document: ExpenseDocumentInput;
  initialPayment?: Omit<ExpensePaymentInput, "operationKey"> | null;
}) {
  const key = normalizeExpenseOperationKey(input.operationKey);
  const validated = validateDocument(input.document);
  const initial = input.initialPayment ?? null;
  if (initial && input.document.documentStatus !== "open") reject("EXPENSE_DRAFT_CANNOT_BE_PAID");
  const initialAmount = initial ? expenseMoneyToCents(initial.amount) : BigInt(0);
  if (initial && initialAmount <= BigInt(0)) reject("EXPENSE_PAYMENT_AMOUNT_INVALID");
  const method = initial ? paymentMethod(initial.paymentMethod) : null;
  if (initialAmount > expenseMoneyToCents(validated.tax.grandTotal)) reject("EXPENSE_OVERPAYMENT");

  return db.transaction(async (tx) => {
    await lockOperation(tx, input.branchId, "expense-create", key);
    const [existing] = await tx.select().from(branchExpenseObligations)
      .where(and(eq(branchExpenseObligations.branchId, input.branchId), eq(branchExpenseObligations.idempotencyKey, key)))
      .limit(1);
    let beneficiary: string;
    if (existing) {
      const [creation] = await tx.select({ metadata: auditLogs.metadata }).from(auditLogs)
        .where(and(
          eq(auditLogs.branchId, input.branchId),
          eq(auditLogs.action, "CREATE_EXPENSE_OBLIGATION"),
          sql`${auditLogs.metadata}->>'obligationId' = ${existing.id}`,
        )).limit(1);
      const metadata = creation?.metadata;
      const originalName = metadata && typeof metadata === "object" && "originalBeneficiaryNameSnapshot" in metadata
        ? metadata.originalBeneficiaryNameSnapshot : null;
      if (typeof originalName !== "string") reject("EXPENSE_INCOMPLETE_REPLAY");
      beneficiary = originalName;
    } else {
      beneficiary = await resolveBeneficiary(tx, input.branchId, validated.supplierId, validated.manualName);
    }
    const canonical = {
      branchId: input.branchId,
      projectId: validated.projectId,
      supplierId: validated.supplierId,
      beneficiaryNameSnapshot: beneficiary,
      concept: validated.concept,
      category: validated.category,
      documentReference: validated.documentReference,
      issueDate: input.document.issueDate,
      dueDate: validated.dueDate,
      notes: validated.notes,
      documentStatus: input.document.documentStatus,
      subtotalAmount: validated.tax.subtotalAmount,
      discountAmount: validated.tax.discountAmount,
      taxMode: input.document.taxMode,
      taxRate: validated.tax.taxRate,
      initialPayment: initial && method ? {
        amount: expenseCentsToMoney(initialAmount), paymentMethod: method,
        entryDate: initial.entryDate, reference: initial.reference, notes: initial.notes,
      } : null,
    };
    const fingerprint = hash(serializeExpenseCreate(canonical));
    if (existing) {
      if (existing.idempotencyFingerprint !== fingerprint) reject("EXPENSE_OPERATION_KEY_CONFLICT");
      if (initial) {
        const [payment] = await tx.select().from(branchExpenseObligationPayments)
          .where(and(eq(branchExpenseObligationPayments.branchId, input.branchId), eq(branchExpenseObligationPayments.obligationId, existing.id), eq(branchExpenseObligationPayments.idempotencyKey, `initial:${existing.id}`)))
          .limit(1);
        if (!payment) reject("EXPENSE_INCOMPLETE_REPLAY");
        await verifyPaymentLink(tx, input.branchId, payment);
      }
      return { id: existing.id, replayed: true };
    }

    await assertProject(tx, input.branchId, validated.projectId);
    const [document] = await tx.insert(branchExpenseObligations).values({
      branchId: input.branchId,
      projectId: validated.projectId,
      supplierId: validated.supplierId,
      beneficiaryNameSnapshot: beneficiary,
      concept: validated.concept,
      category: validated.category,
      documentReference: validated.documentReference,
      issueDate: input.document.issueDate,
      dueDate: validated.dueDate,
      notes: validated.notes,
      documentStatus: input.document.documentStatus,
      ...validated.tax,
      taxMode: input.document.taxMode,
      idempotencyKey: key,
      idempotencyFingerprint: fingerprint,
      createdBy: input.actorUserId,
    }).returning();

    if (initial && method) {
      const paymentCanonical: ExpensePaymentCanonicalInput = {
        branchId: input.branchId, obligationId: document.id,
        amount: expenseCentsToMoney(initialAmount), paymentMethod: method,
        entryDate: initial.entryDate, reference: initial.reference, notes: initial.notes,
      };
      const payment = await insertPayment(tx, {
        branchId: input.branchId, actorUserId: input.actorUserId, document,
        key: `initial:${document.id}`, fingerprint: hash(serializeExpensePayment(paymentCanonical)),
        amount: paymentCanonical.amount, method, entryDate: initial.entryDate,
        reference: normalizeExpenseText(initial.reference), notes: normalizeExpenseText(initial.notes),
      });
      await audit(tx, input.actorUserId, input.branchId, "PAY_EXPENSE_OBLIGATION", {
        obligationId: document.id, paymentId: payment.id, financeEntryId: payment.financeEntryId,
        amountCents: Number(initialAmount), result: "created",
      });
    }
    await audit(tx, input.actorUserId, input.branchId, "CREATE_EXPENSE_OBLIGATION", {
      obligationId: document.id, projectId: document.projectId, supplierId: document.supplierId,
      originalBeneficiaryNameSnapshot: document.beneficiaryNameSnapshot,
      documentStatus: document.documentStatus, result: "created",
    });
    return { id: document.id, replayed: false };
  });
}

export async function payExpenseObligation(input: {
  branchId: string;
  actorUserId: string;
  obligationId: string;
  payment: ExpensePaymentInput;
}) {
  const key = normalizeExpenseOperationKey(input.payment.operationKey);
  const amount = expenseMoneyToCents(input.payment.amount);
  if (amount <= BigInt(0)) reject("EXPENSE_PAYMENT_AMOUNT_INVALID");
  const method = paymentMethod(input.payment.paymentMethod);
  const canonical: ExpensePaymentCanonicalInput = {
    branchId: input.branchId, obligationId: input.obligationId,
    amount: expenseCentsToMoney(amount), paymentMethod: method,
    entryDate: input.payment.entryDate, reference: input.payment.reference, notes: input.payment.notes,
  };
  const fingerprint = hash(serializeExpensePayment(canonical));
  return db.transaction(async (tx) => {
    await lockOperation(tx, input.branchId, "expense-pay", key);
    const [existing] = await tx.select().from(branchExpenseObligationPayments)
      .where(and(eq(branchExpenseObligationPayments.branchId, input.branchId), eq(branchExpenseObligationPayments.idempotencyKey, key)))
      .limit(1);
    if (existing) {
      if (existing.idempotencyFingerprint !== fingerprint) reject("EXPENSE_OPERATION_KEY_CONFLICT");
      if (existing.obligationId !== input.obligationId) reject("EXPENSE_OPERATION_KEY_CONFLICT");
      await verifyPaymentLink(tx, input.branchId, existing);
      return { obligationId: existing.obligationId, paymentId: existing.id, replayed: true };
    }

    const document = await lockDocument(tx, input.branchId, input.obligationId);
    const alreadyPaid = await paidCents(tx, input.branchId, document.id);
    assertExpensePaymentAllowed({
      documentStatus: document.documentStatus as "draft" | "open" | "cancelled",
      total: document.grandTotal,
      paid: expenseCentsToMoney(alreadyPaid), amount: canonical.amount,
    });
    const payment = await insertPayment(tx, {
      branchId: input.branchId, actorUserId: input.actorUserId, document,
      key, fingerprint, amount: canonical.amount, method,
      entryDate: canonical.entryDate, reference: normalizeExpenseText(canonical.reference),
      notes: normalizeExpenseText(canonical.notes),
    });
    await audit(tx, input.actorUserId, input.branchId, "PAY_EXPENSE_OBLIGATION", {
      obligationId: document.id, paymentId: payment.id, financeEntryId: payment.financeEntryId,
      amountCents: Number(amount), result: "created",
    });
    return { obligationId: document.id, paymentId: payment.id, replayed: false };
  });
}

export async function transitionExpenseObligation(input: {
  branchId: string;
  actorUserId: string;
  obligationId: string;
  action: "confirm" | "cancel" | "edit" | "reassign";
  changes?: ExpenseDocumentInput;
  projectId?: string | null;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '20s'`);
    const document = await lockDocument(tx, input.branchId, input.obligationId);
    const paid = await paidCents(tx, input.branchId, document.id);
    assertExpenseDocumentUnpaid(expenseCentsToMoney(paid));
    if (document.documentStatus === "cancelled") reject("EXPENSE_DOCUMENT_CANCELLED");
    if (input.action === "confirm") {
      if (document.documentStatus !== "draft") reject("EXPENSE_INVALID_TRANSITION");
      await tx.update(branchExpenseObligations).set({ documentStatus: "open", updatedAt: new Date() })
        .where(and(eq(branchExpenseObligations.branchId, input.branchId), eq(branchExpenseObligations.id, document.id)));
    } else if (input.action === "cancel") {
      await tx.update(branchExpenseObligations).set({ documentStatus: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(branchExpenseObligations.branchId, input.branchId), eq(branchExpenseObligations.id, document.id)));
    } else if (input.action === "reassign") {
      const projectId = input.projectId?.trim() || null;
      await assertProject(tx, input.branchId, projectId);
      await tx.update(branchExpenseObligations).set({ projectId, updatedAt: new Date() })
        .where(and(eq(branchExpenseObligations.branchId, input.branchId), eq(branchExpenseObligations.id, document.id)));
    } else {
      if (!input.changes) reject("EXPENSE_INVALID_TRANSITION");
      const validated = validateDocument(input.changes);
      if (input.changes.documentStatus !== document.documentStatus) reject("EXPENSE_INVALID_TRANSITION");
      if (validated.projectId !== document.projectId) reject("EXPENSE_PROJECT_REASSIGN_REQUIRED");
      const beneficiary = await resolveBeneficiary(tx, input.branchId, validated.supplierId, validated.manualName);
      await tx.update(branchExpenseObligations).set({
        projectId: document.projectId,
        supplierId: validated.supplierId,
        beneficiaryNameSnapshot: beneficiary,
        concept: validated.concept,
        category: validated.category,
        documentReference: validated.documentReference,
        issueDate: input.changes.issueDate,
        dueDate: validated.dueDate,
        notes: validated.notes,
        ...validated.tax,
        taxMode: input.changes.taxMode,
        updatedAt: new Date(),
      }).where(and(eq(branchExpenseObligations.branchId, input.branchId), eq(branchExpenseObligations.id, document.id)));
    }
    await audit(tx, input.actorUserId, input.branchId, `${input.action.toUpperCase()}_EXPENSE_OBLIGATION`, {
      obligationId: document.id, result: "updated",
    });
    return { id: document.id };
  });
}

export async function listExpenseObligations(branchId: string, filters: {
  page: number;
  pageSize: number;
  projectId?: string | null;
  status?: string | null;
}) {
  const page = Math.max(1, Math.trunc(filters.page || 1));
  const pageSize = Math.min(50, Math.max(1, Math.trunc(filters.pageSize || 25)));
  const clauses = [eq(branchExpenseObligations.branchId, branchId)];
  if (filters.projectId) clauses.push(eq(branchExpenseObligations.projectId, filters.projectId));
  if (filters.status) clauses.push(eq(branchExpenseObligations.documentStatus, filters.status));
  const payments = db.select({
    branchId: branchExpenseObligationPayments.branchId,
    obligationId: branchExpenseObligationPayments.obligationId,
    paid: sql<string>`COALESCE(SUM(${branchExpenseObligationPayments.amount}), 0)`.as("paid"),
  }).from(branchExpenseObligationPayments)
    .where(eq(branchExpenseObligationPayments.branchId, branchId))
    .groupBy(branchExpenseObligationPayments.branchId, branchExpenseObligationPayments.obligationId)
    .as("expense_paid");
  const [rows, totalRows] = await Promise.all([
    db.select({ document: branchExpenseObligations, paid: payments.paid })
      .from(branchExpenseObligations)
      .leftJoin(payments, and(eq(payments.branchId, branchExpenseObligations.branchId), eq(payments.obligationId, branchExpenseObligations.id)))
      .where(and(...clauses)).orderBy(desc(branchExpenseObligations.issueDate), desc(branchExpenseObligations.createdAt))
      .limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(branchExpenseObligations).where(and(...clauses)),
  ]);
  return {
    items: rows.map(({ document, paid }) => {
      const paidAmount = expenseMoneyToCents(String(paid ?? "0"));
      const grandTotal = expenseMoneyToCents(document.grandTotal);
      return {
        ...document,
        paidAmount: expenseCentsToMoney(paidAmount),
        pendingAmount: expenseCentsToMoney(grandTotal - paidAmount),
        paymentStatus: paidAmount === BigInt(0) ? "unpaid" : paidAmount === grandTotal ? "paid" : "partial",
      };
    }),
    page, pageSize, total: totalRows[0]?.total ?? 0,
  };
}

export async function getExpenseObligationDetail(branchId: string, id: string, page = 1) {
  const [document] = await db.select().from(branchExpenseObligations)
    .where(and(eq(branchExpenseObligations.branchId, branchId), eq(branchExpenseObligations.id, id)))
    .limit(1);
  if (!document) return null;
  const pageSize = 25;
  const paymentPage = Math.max(1, Math.trunc(page));
  const [payments, paidRows, countRows] = await Promise.all([
    db.select().from(branchExpenseObligationPayments)
      .where(and(eq(branchExpenseObligationPayments.branchId, branchId), eq(branchExpenseObligationPayments.obligationId, id)))
      .orderBy(desc(branchExpenseObligationPayments.paidAt), desc(branchExpenseObligationPayments.id))
      .limit(pageSize).offset((paymentPage - 1) * pageSize),
    db.select({ total: sql<string>`COALESCE(SUM(${branchExpenseObligationPayments.amount}), 0)` })
      .from(branchExpenseObligationPayments)
      .where(and(eq(branchExpenseObligationPayments.branchId, branchId), eq(branchExpenseObligationPayments.obligationId, id))),
    db.select({ total: count() }).from(branchExpenseObligationPayments)
      .where(and(eq(branchExpenseObligationPayments.branchId, branchId), eq(branchExpenseObligationPayments.obligationId, id))),
  ]);
  const paid = expenseMoneyToCents(String(paidRows[0]?.total ?? "0"));
  const grandTotal = expenseMoneyToCents(document.grandTotal);
  return {
    ...document,
    paidAmount: expenseCentsToMoney(paid),
    pendingAmount: expenseCentsToMoney(grandTotal - paid),
    paymentStatus: paid === BigInt(0) ? "unpaid" : paid === grandTotal ? "paid" : "partial",
    payments,
    paymentPage,
    paymentTotal: countRows[0]?.total ?? 0,
  };
}
