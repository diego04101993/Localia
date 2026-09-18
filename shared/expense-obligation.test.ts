import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExpenseDocumentUnpaid,
  assertExpensePaymentAllowed,
  computeExpenseObligationTax,
  expenseMoneyToCents,
  normalizeExpenseOperationKey,
  serializeExpenseCreate,
  serializeExpensePayment,
} from "./expense-obligation";

test("tax snapshots use exact cents for all modes and discounts", () => {
  assert.deepEqual(computeExpenseObligationTax({ subtotalAmount: "1000.00", discountAmount: "0.00", taxMode: "tax_added", taxRate: "16" }), {
    subtotalAmount: "1000.00", discountAmount: "0.00", subtotalBeforeTax: "1000.00",
    taxableSubtotal: "1000.00", taxRate: "16.0000", taxTotal: "160.00", grandTotal: "1160.00",
  });
  assert.equal(computeExpenseObligationTax({ subtotalAmount: "1160.00", discountAmount: "116.00", taxMode: "tax_included", taxRate: "16" }).taxableSubtotal, "900.00");
  assert.equal(computeExpenseObligationTax({ subtotalAmount: "50.00", discountAmount: "0.00", taxMode: "tax_included", taxRate: "16" }).taxTotal, "6.90");
  assert.equal(computeExpenseObligationTax({ subtotalAmount: "1000.00", discountAmount: "100.00", taxMode: "tax_exempt", taxRate: "0" }).grandTotal, "900.00");
});

test("numeric limits, precision and non-finite values are rejected before persistence", () => {
  assert.throws(() => computeExpenseObligationTax({ subtotalAmount: "9999999999.99", discountAmount: "0.00", taxMode: "tax_added", taxRate: "16" }), /OVERFLOW/);
  assert.throws(() => expenseMoneyToCents("NaN"), /INVALID/);
  assert.throws(() => expenseMoneyToCents("Infinity"), /INVALID/);
  assert.throws(() => expenseMoneyToCents("1.001"), /INVALID/);
  assert.throws(() => computeExpenseObligationTax({ subtotalAmount: "100.00", discountAmount: "100.00", taxMode: "tax_exempt", taxRate: "0" }), /DISCOUNT/);
  assert.throws(() => computeExpenseObligationTax({ subtotalAmount: "100.00", discountAmount: "0.00", taxMode: "tax_added", taxRate: "16.12345" }), /RATE/);
});

test("canonical payload is stable across equivalent amounts and rejects changed payload", () => {
  const base = {
    branchId: "branch-a", projectId: null, supplierId: null, beneficiaryNameSnapshot: "Proveedor",
    concept: "Servicio", category: null, documentReference: null, issueDate: "2026-09-15",
    dueDate: null, notes: null, documentStatus: "open" as const, subtotalAmount: "1000.00",
    discountAmount: "0.00", taxMode: "tax_added" as const, taxRate: "16", initialPayment: null,
  };
  assert.equal(serializeExpenseCreate(base), serializeExpenseCreate({ ...base, taxRate: "16.0000" }));
  assert.notEqual(serializeExpenseCreate(base), serializeExpenseCreate({ ...base, concept: "Otro servicio" }));
  assert.equal(normalizeExpenseOperationKey(" same-key-123 "), "same-key-123");
  assert.throws(() => normalizeExpenseOperationKey("bad key"), /INVALID/);
  assert.equal(serializeExpensePayment({ branchId: "branch-a", obligationId: "doc", amount: "500.00", paymentMethod: "EFECTIVO", entryDate: "2026-09-15" }),
    serializeExpensePayment({ branchId: "branch-a", obligationId: "doc", amount: "500", paymentMethod: "efectivo", entryDate: "2026-09-15" }));
});

test("payment arithmetic preserves economic expense while cash and balance move", () => {
  const base = expenseMoneyToCents("1000.00");
  const total = expenseMoneyToCents("1160.00");
  for (const [paid, balance] of [["0.00", "1160.00"], ["500.00", "660.00"], ["1160.00", "0.00"]]) {
    assert.equal(total - expenseMoneyToCents(paid), expenseMoneyToCents(balance));
    assert.equal(base, expenseMoneyToCents("1000.00"));
  }
});

test("payment, cancellation and edit guards use the persisted ledger balance", () => {
  assert.equal(assertExpensePaymentAllowed({ documentStatus: "open", total: "1160.00", paid: "500.00", amount: "660.00" }), "0.00");
  assert.throws(() => assertExpensePaymentAllowed({ documentStatus: "open", total: "1160.00", paid: "500.00", amount: "660.01" }), /OVERPAYMENT/);
  assert.throws(() => assertExpensePaymentAllowed({ documentStatus: "open", total: "1160.00", paid: "500.00", amount: "661.00" }), /OVERPAYMENT/);
  assert.throws(() => assertExpensePaymentAllowed({ documentStatus: "open", total: "1160.00", paid: "1160.00", amount: "1.00" }), /OVERPAYMENT/);
  assert.throws(() => assertExpensePaymentAllowed({ documentStatus: "draft", total: "1160.00", paid: "0.00", amount: "500.00" }), /NOT_OPEN/);
  assert.throws(() => assertExpensePaymentAllowed({ documentStatus: "cancelled", total: "1160.00", paid: "0.00", amount: "500.00" }), /NOT_OPEN/);
  assert.doesNotThrow(() => assertExpenseDocumentUnpaid("0.00"));
  assert.throws(() => assertExpenseDocumentUnpaid("0.01"), /HAS_PAYMENTS/);
});
