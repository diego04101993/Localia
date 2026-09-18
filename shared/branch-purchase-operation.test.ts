import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { beginStableOperationAttempt } from "../client/src/lib/stable-operation-key";
import {
  branchPurchaseMoneyToCents,
  deriveBranchPurchasePaymentStatus,
  getBranchPurchaseCancellationBlockReason,
  getBranchPurchaseLegacyPaidCents,
  resolveBranchPurchaseParentPaymentMethod,
  serializeBranchPurchaseCreateCanonicalPayload,
  type BranchPurchaseCreateCanonicalInput,
  type BranchPurchasePaymentCanonicalInput,
} from "./branch-purchase-operation";
import { isProtectedFinanceSource } from "./finance-source";
import { createBranchPurchaseSchema, registerBranchPurchasePaymentSchema } from "./schema";
import {
  BranchPurchaseIdempotencyError,
  BRANCH_PURCHASE_OPERATION_KEY_CONFLICT,
  commitLockedBranchPurchaseOperation,
  createBranchPurchasePayloadFingerprint,
  createBranchPurchasePaymentFingerprint,
} from "../server/branch-purchase-operation";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type FakePurchase = {
  id: string;
  branchId: string;
  operationKey: string;
  fingerprint: string;
  totalCents: number;
  paidCents: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  paymentMethod: string | null;
  status: string;
  receivedUnits: number;
  inventoryMovements: number;
  projectId: string | null;
};

type FakePayment = {
  id: string;
  branchId: string;
  purchaseId: string;
  operationKey: string;
  fingerprint: string;
  amountCents: number;
  paymentMethod: string;
  financeEntryId: string;
};

type FakeState = {
  purchases: Map<string, FakePurchase>;
  payments: Map<string, FakePayment>;
  finance: string[];
  audits: string[];
  items: string[];
  productReferenceCosts: Map<string, number>;
};

function createMutex() {
  let queue = Promise.resolve();
  return async () => {
    let release = () => {};
    const current = new Promise<void>((resolve) => { release = resolve; });
    const previous = queue;
    queue = queue.then(() => current);
    await previous;
    return release;
  };
}

function cloneState(state: FakeState): FakeState {
  return {
    purchases: new Map(Array.from(state.purchases, ([key, value]) => [key, { ...value }])),
    payments: new Map(Array.from(state.payments, ([key, value]) => [key, { ...value }])),
    finance: [...state.finance],
    audits: [...state.audits],
    items: [...state.items],
    productReferenceCosts: new Map(state.productReferenceCosts),
  };
}

const baseCreatePayload: BranchPurchaseCreateCanonicalInput = {
  branchId: "branch-yoga",
  supplierId: "supplier-1",
  projectId: "project-1",
  status: "draft",
  purchaseDate: "2026-09-10",
  expectedDate: "2026-09-15",
  discountAmount: 0,
  taxMode: "tax_exempt",
  taxRate: 0,
  reference: "FACT-001",
  notes: "Compra de prueba",
  items: [{
    commercialProductId: "product-1",
    quantityOrdered: 2,
    unitCost: 50,
    updateReferenceCost: false,
  }],
  initialPayment: null,
};

function createHarness(options?: { legacyPaidCents?: number }) {
  const legacyPaidCents = options?.legacyPaidCents ?? 0;
  let state: FakeState = {
    purchases: new Map(),
    payments: new Map(),
    finance: [],
    audits: [],
    items: [],
    productReferenceCosts: new Map([["product-1", 2500]]),
  };
  if (legacyPaidCents > 0) {
    state.purchases.set("legacy", {
      id: "purchase-legacy",
      branchId: "branch-yoga",
      operationKey: "",
      fingerprint: "",
      totalCents: 1_392_000,
      paidCents: legacyPaidCents,
      paymentStatus: "partial",
      paymentMethod: "efectivo",
      status: "draft",
      receivedUnits: 0,
      inventoryMovements: 0,
      projectId: "project-legacy",
    });
  }

  const acquireTransaction = createMutex();
  let sequence = 0;

  const transaction = async <T>(work: (draft: FakeState) => Promise<T>) => {
    const release = await acquireTransaction();
    const draft = cloneState(state);
    try {
      const result = await work(draft);
      state = draft;
      return result;
    } finally {
      release();
    }
  };

  async function createPurchase(input: {
    key: string;
    payload?: BranchPurchaseCreateCanonicalInput;
    failAt?: "after_purchase" | "after_payment" | "before_audit";
  }) {
    const payload = input.payload ?? baseCreatePayload;
    const fingerprint = createBranchPurchasePayloadFingerprint(payload);
    return commitLockedBranchPurchaseOperation<FakeState, FakePurchase, FakePurchase>({
      fingerprint,
      transaction,
      acquireLock: async () => {},
      findExisting: async (draft) => draft.purchases.get(`${payload.branchId}:${input.key}`),
      getExistingFingerprint: (existing) => existing.fingerprint,
      replay: async (_draft, existing) => existing,
      create: async (draft) => {
        const totalCents = payload.items.reduce(
          (sum, item) => sum + branchPurchaseMoneyToCents(item.unitCost) * item.quantityOrdered,
          0,
        ) - branchPurchaseMoneyToCents(payload.discountAmount);
        const initialCents = payload.initialPayment ? branchPurchaseMoneyToCents(payload.initialPayment.amount) : 0;
        if (initialCents > totalCents) throw new Error("OVERPAYMENT");
        const purchase: FakePurchase = {
          id: `purchase-${++sequence}`,
          branchId: payload.branchId,
          operationKey: input.key,
          fingerprint,
          totalCents,
          paidCents: initialCents,
          paymentStatus: deriveBranchPurchasePaymentStatus(initialCents, totalCents),
          paymentMethod: payload.initialPayment?.paymentMethod ?? null,
          status: payload.status,
          receivedUnits: 0,
          inventoryMovements: 0,
          projectId: payload.projectId ?? null,
        };
        draft.purchases.set(`${payload.branchId}:${input.key}`, purchase);
        draft.items.push(`${purchase.id}:product-1`);
        if (payload.items[0]?.updateReferenceCost) {
          draft.productReferenceCosts.set("product-1", branchPurchaseMoneyToCents(payload.items[0].unitCost));
        }
        if (input.failAt === "after_purchase") throw new Error("FAIL_AFTER_PURCHASE");
        if (initialCents > 0) {
          draft.payments.set(`${payload.branchId}:initial:${purchase.id}`, {
            id: `payment-${sequence}`,
            branchId: payload.branchId,
            purchaseId: purchase.id,
            operationKey: `initial:${purchase.id}`,
            fingerprint,
            amountCents: initialCents,
            paymentMethod: payload.initialPayment!.paymentMethod,
            financeEntryId: `finance-${sequence}`,
          });
          draft.finance.push(`finance-${sequence}`);
        }
        if (input.failAt === "after_payment") throw new Error("FAIL_AFTER_PAYMENT");
        if (input.failAt === "before_audit") throw new Error("FAIL_BEFORE_AUDIT");
        draft.audits.push(`create:${purchase.id}`);
        return purchase;
      },
    });
  }

  async function payPurchase(input: {
    purchaseId: string;
    branchId?: string;
    key: string;
    amountCents: number;
    paymentMethod?: string;
    failAt?: "after_finance" | "before_audit";
  }) {
    const branchId = input.branchId ?? "branch-yoga";
    const paymentMethod = input.paymentMethod ?? "efectivo";
    const payload: BranchPurchasePaymentCanonicalInput = {
      branchId,
      purchaseId: input.purchaseId,
      amount: input.amountCents / 100,
      paymentMethod,
      entryDate: "2026-09-10",
      reference: null,
      notes: null,
    };
    const fingerprint = createBranchPurchasePaymentFingerprint(payload);
    return commitLockedBranchPurchaseOperation<FakeState, FakePayment, FakePayment>({
      fingerprint,
      transaction,
      acquireLock: async () => {},
      findExisting: async (draft) => draft.payments.get(`${branchId}:${input.key}`),
      getExistingFingerprint: (existing) => existing.fingerprint,
      replay: async (_draft, existing) => existing,
      create: async (draft) => {
        const purchase = Array.from(draft.purchases.values()).find(
          (candidate) => candidate.id === input.purchaseId && candidate.branchId === branchId,
        );
        if (!purchase) throw new Error("NOT_FOUND");
        if (purchase.status === "cancelled") throw new Error("NOT_ALLOWED");
        const nextPaidCents = purchase.paidCents + input.amountCents;
        if (nextPaidCents > purchase.totalCents) throw new Error("OVERPAYMENT");
        const payment: FakePayment = {
          id: `payment-${++sequence}`,
          branchId,
          purchaseId: purchase.id,
          operationKey: input.key,
          fingerprint,
          amountCents: input.amountCents,
          paymentMethod,
          financeEntryId: `finance-${sequence}`,
        };
        draft.finance.push(payment.financeEntryId);
        if (input.failAt === "after_finance") throw new Error("FAIL_AFTER_FINANCE");
        draft.payments.set(`${branchId}:${input.key}`, payment);
        const existingMethods = Array.from(draft.payments.values())
          .filter((item) => item.purchaseId === purchase.id && item.id !== payment.id)
          .map((item) => item.paymentMethod);
        purchase.paymentMethod = resolveBranchPurchaseParentPaymentMethod({
          currentPaidCents: purchase.paidCents,
          currentPaymentMethod: purchase.paymentMethod,
          detailedPaymentMethods: existingMethods,
          newPaymentMethod: paymentMethod,
        });
        purchase.paidCents = nextPaidCents;
        purchase.paymentStatus = deriveBranchPurchasePaymentStatus(nextPaidCents, purchase.totalCents);
        if (input.failAt === "before_audit") throw new Error("FAIL_BEFORE_AUDIT");
        draft.audits.push(`payment:${payment.id}`);
        return payment;
      },
    });
  }

  return {
    createPurchase,
    payPurchase,
    getState: () => state,
    getLegacy: () => state.purchases.get("legacy")!,
  };
}

test("1. create purchase persists one idempotent operation", async () => {
  const harness = createHarness();
  const result = await harness.createPurchase({ key: "create-one" });
  assert.equal(result.replayed, false);
  assert.equal(harness.getState().purchases.size, 1);
  assert.equal(harness.getState().items.length, 1);
  assert.equal(harness.getState().audits.length, 1);
});

test("2. exact create retry returns the original result without writes", async () => {
  const harness = createHarness();
  const first = await harness.createPurchase({ key: "create-replay" });
  const before = cloneState(harness.getState());
  const second = await harness.createPurchase({ key: "create-replay" });
  assert.equal(second.replayed, true);
  assert.equal(second.result.id, first.result.id);
  assert.deepEqual(harness.getState(), before);
});

test("3. same create key with a different payload conflicts", async () => {
  const harness = createHarness();
  await harness.createPurchase({ key: "create-conflict" });
  await assert.rejects(
    harness.createPurchase({ key: "create-conflict", payload: { ...baseCreatePayload, notes: "Distinto" } }),
    (error: unknown) => error instanceof BranchPurchaseIdempotencyError
      && error.code === BRANCH_PURCHASE_OPERATION_KEY_CONFLICT,
  );
});

test("4. concurrent create requests with one key create one purchase", async () => {
  const harness = createHarness();
  const results = await Promise.all([
    harness.createPurchase({ key: "create-concurrent" }),
    harness.createPurchase({ key: "create-concurrent" }),
  ]);
  assert.equal(results.filter((result) => result.replayed).length, 1);
  assert.equal(harness.getState().purchases.size, 1);
});

test("5. purchase without initial payment creates no payment or finance entry", async () => {
  const harness = createHarness();
  const result = await harness.createPurchase({ key: "create-unpaid" });
  assert.equal(result.result.paymentStatus, "unpaid");
  assert.equal(harness.getState().payments.size, 0);
  assert.equal(harness.getState().finance.length, 0);
});

test("6. purchase with initial payment creates one ledger payment and one expense", async () => {
  const harness = createHarness();
  const payload = {
    ...baseCreatePayload,
    initialPayment: { amount: 40, paymentMethod: "transferencia", entryDate: "2026-09-10" },
  };
  const result = await harness.createPurchase({ key: "create-paid", payload });
  assert.equal(result.result.paidCents, 4000);
  assert.equal(harness.getState().payments.size, 1);
  assert.equal(harness.getState().finance.length, 1);
});

test("7. subsequent payment writes ledger, finance and aggregate", async () => {
  const harness = createHarness();
  const purchase = (await harness.createPurchase({ key: "create-for-pay" })).result;
  await harness.payPurchase({ purchaseId: purchase.id, key: "pay-one-01", amountCents: 3000 });
  const current = Array.from(harness.getState().purchases.values())[0];
  assert.equal(current.paidCents, 3000);
  assert.equal(harness.getState().payments.size, 1);
  assert.equal(harness.getState().finance.length, 1);
});

test("8. exact payment retry does not duplicate any write", async () => {
  const harness = createHarness();
  const purchase = (await harness.createPurchase({ key: "create-pay-replay" })).result;
  await harness.payPurchase({ purchaseId: purchase.id, key: "payment-replay", amountCents: 2000 });
  const before = cloneState(harness.getState());
  const replay = await harness.payPurchase({ purchaseId: purchase.id, key: "payment-replay", amountCents: 2000 });
  assert.equal(replay.replayed, true);
  assert.deepEqual(harness.getState(), before);
});

test("9. same payment key with another amount conflicts", async () => {
  const harness = createHarness();
  const purchase = (await harness.createPurchase({ key: "create-pay-conflict" })).result;
  await harness.payPurchase({ purchaseId: purchase.id, key: "payment-conflict", amountCents: 2000 });
  await assert.rejects(
    harness.payPurchase({ purchaseId: purchase.id, key: "payment-conflict", amountCents: 2100 }),
    (error: unknown) => error instanceof BranchPurchaseIdempotencyError,
  );
});

test("10. different concurrent payment keys cannot overpay the locked aggregate", async () => {
  const harness = createHarness();
  const purchase = (await harness.createPurchase({ key: "create-overpay-race" })).result;
  const results = await Promise.allSettled([
    harness.payPurchase({ purchaseId: purchase.id, key: "payment-race-a", amountCents: 7000 }),
    harness.payPurchase({ purchaseId: purchase.id, key: "payment-race-b", amountCents: 7000 }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(Array.from(harness.getState().purchases.values())[0].paidCents, 7000);
});

test("11. legacy 120 plus a new 100 produces aggregate 220", async () => {
  const harness = createHarness({ legacyPaidCents: 12_000 });
  await harness.payPurchase({ purchaseId: "purchase-legacy", key: "legacy-payment", amountCents: 10_000 });
  assert.equal(harness.getLegacy().paidCents, 22_000);
  assert.equal(harness.getState().payments.size, 1);
});

test("12. legacy paid amount never receives a synthetic payment", () => {
  const harness = createHarness({ legacyPaidCents: 12_000 });
  assert.equal(harness.getState().payments.size, 0);
  assert.equal(getBranchPurchaseLegacyPaidCents(harness.getLegacy().paidCents, 0), 12_000);
});

test("13. payment status is derived exclusively from exact cents", () => {
  assert.equal(deriveBranchPurchasePaymentStatus(0, 10000), "unpaid");
  assert.equal(deriveBranchPurchasePaymentStatus(1, 10000), "partial");
  assert.equal(deriveBranchPurchasePaymentStatus(10000, 10000), "paid");
});

test("14. overpayment is rejected without mutations", async () => {
  const harness = createHarness();
  const purchase = (await harness.createPurchase({ key: "create-overpay" })).result;
  const before = cloneState(harness.getState());
  await assert.rejects(harness.payPurchase({ purchaseId: purchase.id, key: "overpay-key", amountCents: 10001 }), /OVERPAYMENT/);
  assert.deepEqual(harness.getState(), before);
});

test("15. branch mismatch cannot locate or mutate a purchase", async () => {
  const harness = createHarness();
  const purchase = (await harness.createPurchase({ key: "create-tenant" })).result;
  const before = cloneState(harness.getState());
  await assert.rejects(
    harness.payPurchase({ purchaseId: purchase.id, branchId: "other-branch", key: "other-tenant", amountCents: 100 }),
    /NOT_FOUND/,
  );
  assert.deepEqual(harness.getState(), before);
});

test("16. purchase_payment is centrally protected", () => {
  assert.equal(isProtectedFinanceSource("purchase_payment"), true);
});

test("17. protected source blocks finance PATCH through the shared route guard", () => {
  const routes = readFileSync(path.join(repositoryRoot, "server/routes.ts"), "utf8");
  assert.match(routes, /app\.patch\("\/api\/branch\/finance\/entries\/:id"[\s\S]*?classifyFinanceSource\(existingEntry\.source\) !== "manual"/);
});

test("18. protected source blocks finance DELETE through the shared route guard", () => {
  const routes = readFileSync(path.join(repositoryRoot, "server/routes.ts"), "utf8");
  assert.match(routes, /app\.delete\("\/api\/branch\/finance\/entries\/:id"[\s\S]*?classifyFinanceSource\(existingEntry\.source\) !== "manual"/);
});

test("19. cancellation with any paid aggregate or ledger row is blocked", () => {
  assert.equal(getBranchPurchaseCancellationBlockReason({ status: "draft", paymentStatus: "partial", paidCents: 0, paymentRows: 0, receivedUnits: 0, inventoryMovements: 0 }), "BRANCH_PURCHASE_CANNOT_CANCEL_PAID");
  assert.equal(getBranchPurchaseCancellationBlockReason({ status: "draft", paymentStatus: "unpaid", paidCents: 1, paymentRows: 0, receivedUnits: 0, inventoryMovements: 0 }), "BRANCH_PURCHASE_CANNOT_CANCEL_PAID");
  assert.equal(getBranchPurchaseCancellationBlockReason({ status: "draft", paymentStatus: "unpaid", paidCents: 0, paymentRows: 1, receivedUnits: 0, inventoryMovements: 0 }), "BRANCH_PURCHASE_CANNOT_CANCEL_PAID");
});

test("20. cancellation after receipt or inventory movement is blocked", () => {
  assert.equal(getBranchPurchaseCancellationBlockReason({ status: "draft", paymentStatus: "unpaid", paidCents: 0, paymentRows: 0, receivedUnits: 1, inventoryMovements: 0 }), "BRANCH_PURCHASE_CANNOT_CANCEL_RECEIVED");
  assert.equal(getBranchPurchaseCancellationBlockReason({ status: "draft", paymentStatus: "unpaid", paidCents: 0, paymentRows: 0, receivedUnits: 0, inventoryMovements: 1 }), "BRANCH_PURCHASE_CANNOT_CANCEL_RECEIVED");
});

test("21. clean draft cancellation remains allowed", () => {
  assert.equal(getBranchPurchaseCancellationBlockReason({ status: "draft", paymentStatus: "unpaid", paidCents: 0, paymentRows: 0, receivedUnits: 0, inventoryMovements: 0 }), null);
});

test("22. updateReferenceCost true is canonical and changes only the reference cost", async () => {
  const harness = createHarness();
  const payload = { ...baseCreatePayload, items: [{ ...baseCreatePayload.items[0], unitCost: 75, updateReferenceCost: true }] };
  assert.match(serializeBranchPurchaseCreateCanonicalPayload(payload), /"updateReferenceCost":true/);
  await harness.createPurchase({ key: "reference-true", payload });
  assert.equal(harness.getState().productReferenceCosts.get("product-1"), 7500);
});

test("23. updateReferenceCost false preserves the existing reference cost", async () => {
  const harness = createHarness();
  await harness.createPurchase({ key: "reference-false" });
  assert.equal(harness.getState().productReferenceCosts.get("product-1"), 2500);
});

test("24. reference cost update rolls back with purchase failure", async () => {
  const harness = createHarness();
  const payload = { ...baseCreatePayload, items: [{ ...baseCreatePayload.items[0], unitCost: 75, updateReferenceCost: true }] };
  await assert.rejects(harness.createPurchase({ key: "reference-rollback", payload, failAt: "after_purchase" }));
  assert.equal(harness.getState().productReferenceCosts.get("product-1"), 2500);
});

test("25. sale cancellation restores inventory under ordered row locks", () => {
  const storage = readFileSync(path.join(repositoryRoot, "server/storage.ts"), "utf8");
  const start = storage.indexOf("const restorableMovements = inventoryMovementRows");
  const end = storage.indexOf("const paymentMethods =", start);
  const block = storage.slice(start, end);
  assert.match(block, /\.sort\(/);
  assert.match(block, /getLockedBranchInventoryBalance/);
  assert.doesNotMatch(block, /\.select\(\)\s*\.from\(branchInventoryBalances\)/);
});

test("26. purge deletes purchase payments before finance and purchases", () => {
  const storage = readFileSync(path.join(repositoryRoot, "server/storage.ts"), "utf8");
  const payments = storage.indexOf("tx.delete(branchPurchasePayments)");
  const finance = storage.indexOf("tx.delete(branchFinanceEntries)", payments);
  const purchases = storage.indexOf("tx.delete(branchPurchases)", finance);
  assert.ok(payments > 0 && payments < finance && finance < purchases);
});

test("27. intermediate finance failure rolls back purchase payment and aggregate", async () => {
  const harness = createHarness();
  const purchase = (await harness.createPurchase({ key: "create-failure" })).result;
  const before = cloneState(harness.getState());
  await assert.rejects(harness.payPurchase({ purchaseId: purchase.id, key: "pay-failure", amountCents: 1000, failAt: "after_finance" }));
  assert.deepEqual(harness.getState(), before);
});

test("28. audit failure rolls back the complete purchase operation", async () => {
  const harness = createHarness();
  await assert.rejects(harness.createPurchase({
    key: "audit-failure",
    payload: {
      ...baseCreatePayload,
      initialPayment: { amount: 40, paymentMethod: "transferencia", entryDate: "2026-09-10" },
    },
    failAt: "before_audit",
  }));
  assert.equal(harness.getState().purchases.size, 0);
  assert.equal(harness.getState().items.length, 0);
  assert.equal(harness.getState().payments.size, 0);
  assert.equal(harness.getState().finance.length, 0);
});

test("29. project relationship remains indirect through purchase and payment", async () => {
  const harness = createHarness();
  const purchase = (await harness.createPurchase({ key: "project-link" })).result;
  const payment = await harness.payPurchase({ purchaseId: purchase.id, key: "project-payment", amountCents: 1000 });
  assert.equal(purchase.projectId, "project-1");
  assert.equal(payment.result.purchaseId, purchase.id);
  assert.equal("projectId" in payment.result, false);
});

test("30. new runtime is branch-admin scoped and does not add public/mobile routes", () => {
  const routes = readFileSync(path.join(repositoryRoot, "server/routes.ts"), "utf8");
  assert.match(routes, /app\.post\("\/api\/branch\/purchases", requireBranchAdmin/);
  assert.match(routes, /app\.post\("\/api\/branch\/purchases\/:id\/pay", requireBranchAdmin/);
  assert.doesNotMatch(routes, /app\.post\("\/api\/public\/[^"\n]*purchase/);
});

test("request schemas require stable keys and server-authoritative payment state", () => {
  const createRequest = {
    operationKey: "create-schema-key",
    purchaseDate: "2026-09-10",
    items: [{ commercialProductId: "product-1", quantityOrdered: 1, unitCost: 10 }],
  };
  assert.equal(createBranchPurchaseSchema.safeParse(createRequest).success, true);
  assert.equal(createBranchPurchaseSchema.safeParse({ ...createRequest, operationKey: "" }).success, false);
  assert.equal(registerBranchPurchasePaymentSchema.safeParse({
    operationKey: "payment-schema-key",
    amount: 10,
    paymentMethod: "efectivo",
    entryDate: "2026-09-10",
  }).success, true);
  assert.equal("paymentStatus" in createBranchPurchaseSchema.shape, false);
});

test("stable UI operation attempt prevents a second in-flight submission", () => {
  const first = beginStableOperationAttempt(null, "same-payload", () => "stable-operation-key");
  const second = beginStableOperationAttempt(first.state, "same-payload", () => "different-key");
  assert.equal(first.attempt.allowed, true);
  assert.equal(second.attempt.allowed, false);
  assert.equal(second.attempt.key, "stable-operation-key");
});

test("mixed payment methods remain explicit by clearing the ambiguous parent field", () => {
  assert.equal(resolveBranchPurchaseParentPaymentMethod({
    currentPaidCents: 12000,
    currentPaymentMethod: "efectivo",
    detailedPaymentMethods: [],
    newPaymentMethod: "transferencia",
  }), null);
  assert.equal(resolveBranchPurchaseParentPaymentMethod({
    currentPaidCents: 12000,
    currentPaymentMethod: "efectivo",
    detailedPaymentMethods: [],
    newPaymentMethod: "efectivo",
  }), "efectivo");
});

test("cross-branch commercial products are rejected before reference-cost writes", () => {
  const storage = readFileSync(path.join(repositoryRoot, "server/storage.ts"), "utf8");
  const lookupStart = storage.indexOf("const productRows: BranchCommercialProduct[]");
  const lookupEnd = storage.indexOf("const productMap", lookupStart);
  const lookupBlock = storage.slice(lookupStart, lookupEnd);
  const updateStart = storage.indexOf("if (!item.updateReferenceCost) continue", lookupEnd);
  const updateEnd = storage.indexOf("let initialPaymentId", updateStart);
  const updateBlock = storage.slice(updateStart, updateEnd);

  assert.match(lookupBlock, /eq\(branchCommercialProducts\.branchId, data\.branchId\)/);
  assert.match(updateBlock, /eq\(branchCommercialProducts\.branchId, data\.branchId\)/);
});
