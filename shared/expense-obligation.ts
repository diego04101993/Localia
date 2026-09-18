const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10_000);
const RATE_DENOMINATOR = BigInt(1_000_000);
export const EXPENSE_OBLIGATION_MAX_CENTS = BigInt(999_999_999_999);
export const EXPENSE_OBLIGATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
export const EXPENSE_OBLIGATION_PAYMENT_METHODS = [
  "efectivo", "tarjeta", "transferencia", "mercado_pago", "otro",
] as const;

export type ExpenseObligationTaxMode = "tax_exempt" | "tax_added" | "tax_included";
export type ExpenseObligationStatus = "draft" | "open" | "cancelled";

export function expenseMoneyToCents(value: string): bigint {
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("EXPENSE_OBLIGATION_INVALID_AMOUNT");
  }
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0") || "0");
  if (cents > EXPENSE_OBLIGATION_MAX_CENTS) {
    throw new Error("EXPENSE_OBLIGATION_AMOUNT_OVERFLOW");
  }
  return cents;
}

export function expenseCentsToMoney(cents: bigint): string {
  if (cents < ZERO || cents > EXPENSE_OBLIGATION_MAX_CENTS) {
    throw new Error("EXPENSE_OBLIGATION_AMOUNT_OVERFLOW");
  }
  return `${cents / HUNDRED}.${String(cents % HUNDRED).padStart(2, "0")}`;
}

export function expenseRateToScaled(value: string): bigint {
  if (!/^(0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value)) {
    throw new Error("EXPENSE_OBLIGATION_INVALID_TAX_RATE");
  }
  const [whole, fraction = ""] = value.split(".");
  const rate = BigInt(whole) * TEN_THOUSAND + BigInt(fraction.padEnd(4, "0") || "0");
  if (rate > RATE_DENOMINATOR) throw new Error("EXPENSE_OBLIGATION_INVALID_TAX_RATE");
  return rate;
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  const two = BigInt(2);
  return (numerator * two + denominator) / (denominator * two);
}

export function computeExpenseObligationTax(input: {
  subtotalAmount: string;
  discountAmount: string;
  taxMode: ExpenseObligationTaxMode;
  taxRate: string;
}) {
  const subtotal = expenseMoneyToCents(input.subtotalAmount);
  const discount = expenseMoneyToCents(input.discountAmount);
  const rate = expenseRateToScaled(input.taxRate);
  if (subtotal <= ZERO || discount >= subtotal) {
    throw new Error("EXPENSE_OBLIGATION_INVALID_DISCOUNT");
  }
  if (input.taxMode === "tax_exempt" ? rate !== ZERO : rate === ZERO) {
    throw new Error("EXPENSE_OBLIGATION_INVALID_TAX_RATE");
  }

  const discounted = subtotal - discount;
  let subtotalBeforeTax = subtotal;
  let taxableSubtotal = discounted;
  let taxTotal = ZERO;
  let grandTotal = discounted;
  if (input.taxMode === "tax_added") {
    taxTotal = roundRatio(discounted * rate, RATE_DENOMINATOR);
    grandTotal += taxTotal;
  } else if (input.taxMode === "tax_included") {
    subtotalBeforeTax = roundRatio(subtotal * RATE_DENOMINATOR, RATE_DENOMINATOR + rate);
    taxableSubtotal = roundRatio(discounted * RATE_DENOMINATOR, RATE_DENOMINATOR + rate);
    taxTotal = discounted - taxableSubtotal;
  }

  return {
    subtotalAmount: expenseCentsToMoney(subtotal),
    discountAmount: expenseCentsToMoney(discount),
    subtotalBeforeTax: expenseCentsToMoney(subtotalBeforeTax),
    taxableSubtotal: expenseCentsToMoney(taxableSubtotal),
    taxRate: `${rate / TEN_THOUSAND}.${String(rate % TEN_THOUSAND).padStart(4, "0")}`,
    taxTotal: expenseCentsToMoney(taxTotal),
    grandTotal: expenseCentsToMoney(grandTotal),
  };
}

export function normalizeExpenseOperationKey(value: unknown): string {
  if (typeof value !== "string") throw new Error("EXPENSE_OBLIGATION_OPERATION_KEY_INVALID");
  const key = value.trim();
  if (key.length < 8 || key.length > 120 || !EXPENSE_OBLIGATION_KEY_PATTERN.test(key)) {
    throw new Error("EXPENSE_OBLIGATION_OPERATION_KEY_INVALID");
  }
  return key;
}

export function normalizeExpenseText(value: string | null | undefined): string | null {
  const text = value?.normalize("NFKC").trim().replace(/\s+/g, " ") || "";
  return text || null;
}

export function assertExpensePaymentAllowed(input: {
  documentStatus: ExpenseObligationStatus;
  total: string;
  paid: string;
  amount: string;
}): string {
  if (input.documentStatus !== "open") throw new Error("EXPENSE_DOCUMENT_NOT_OPEN");
  const total = expenseMoneyToCents(input.total);
  const paid = expenseMoneyToCents(input.paid);
  const amount = expenseMoneyToCents(input.amount);
  if (amount <= ZERO) throw new Error("EXPENSE_PAYMENT_AMOUNT_INVALID");
  if (paid > total || amount > total - paid) throw new Error("EXPENSE_OVERPAYMENT");
  return expenseCentsToMoney(total - paid - amount);
}

export function assertExpenseDocumentUnpaid(paid: string): void {
  if (expenseMoneyToCents(paid) > ZERO) throw new Error("EXPENSE_DOCUMENT_HAS_PAYMENTS");
}

export type ExpensePaymentCanonicalInput = {
  branchId: string;
  obligationId: string;
  amount: string;
  paymentMethod: string;
  entryDate: string;
  reference?: string | null;
  notes?: string | null;
};

export function serializeExpensePayment(input: ExpensePaymentCanonicalInput): string {
  return JSON.stringify({
    version: 1,
    operation: "expense_obligation_payment",
    branchId: input.branchId,
    obligationId: input.obligationId,
    amount: expenseCentsToMoney(expenseMoneyToCents(input.amount)),
    paymentMethod: input.paymentMethod.trim().toLowerCase(),
    entryDate: input.entryDate,
    reference: normalizeExpenseText(input.reference),
    notes: normalizeExpenseText(input.notes),
  });
}

export type ExpenseCreateCanonicalInput = {
  branchId: string;
  projectId: string | null;
  supplierId: string | null;
  beneficiaryNameSnapshot: string;
  concept: string;
  category: string | null;
  documentReference: string | null;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  documentStatus: "draft" | "open";
  subtotalAmount: string;
  discountAmount: string;
  taxMode: ExpenseObligationTaxMode;
  taxRate: string;
  initialPayment: Omit<ExpensePaymentCanonicalInput, "branchId" | "obligationId"> | null;
};

export function serializeExpenseCreate(input: ExpenseCreateCanonicalInput): string {
  const tax = computeExpenseObligationTax(input);
  return JSON.stringify({
    version: 1,
    operation: "expense_obligation_create",
    branchId: input.branchId,
    projectId: input.projectId,
    supplierId: input.supplierId,
    beneficiaryNameSnapshot: normalizeExpenseText(input.beneficiaryNameSnapshot),
    concept: normalizeExpenseText(input.concept),
    category: normalizeExpenseText(input.category),
    documentReference: normalizeExpenseText(input.documentReference),
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    notes: normalizeExpenseText(input.notes),
    documentStatus: input.documentStatus,
    subtotalAmount: tax.subtotalAmount,
    discountAmount: tax.discountAmount,
    taxMode: input.taxMode,
    taxRate: tax.taxRate,
    initialPayment: input.initialPayment ? {
      amount: expenseCentsToMoney(expenseMoneyToCents(input.initialPayment.amount)),
      paymentMethod: input.initialPayment.paymentMethod.trim().toLowerCase(),
      entryDate: input.initialPayment.entryDate,
      reference: normalizeExpenseText(input.initialPayment.reference),
      notes: normalizeExpenseText(input.initialPayment.notes),
    } : null,
  });
}
