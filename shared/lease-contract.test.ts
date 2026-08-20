import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateLeaseContractAnniversaryDate,
  calculateLeaseCoveredInstallmentWindow,
  calculateLeaseContractEndDate,
  calculateLeaseContractMetrics,
  calculateLeaseOperationalMembershipWindow,
  getLeaseInstallmentAlertKind,
  getLeaseInstallmentPaymentOperationKey,
} from "./lease-contract";
import { calculateLeaseQuote } from "./lease-quote";

function buildQuoteInput(overrides: Partial<Parameters<typeof calculateLeaseQuote>[0]> = {}) {
  return {
    clientUserId: "client-test",
    leasedItemDescription: "Equipo demo",
    startDate: "2026-08-18",
    termMonths: 24,
    capturedAssetValueCents: 10_000_000,
    surchargeRate: 20,
    downPaymentEnabled: false,
    downPaymentType: null,
    downPaymentAmountCents: null,
    downPaymentRate: null,
    taxMode: "tax_exempt" as const,
    taxRate: 0,
    notes: null,
    ...overrides,
  };
}

test("calculateLeaseContractEndDate keeps commercial end date as anniversary minus one day", () => {
  assert.equal(calculateLeaseContractEndDate("2025-03-15", 24), "2027-03-14");
  assert.equal(calculateLeaseContractEndDate("2025-01-28", 1), "2025-02-27");
  assert.equal(calculateLeaseContractEndDate("2025-01-29", 1), "2025-02-27");
  assert.equal(calculateLeaseContractEndDate("2025-01-30", 1), "2025-02-27");
  assert.equal(calculateLeaseContractEndDate("2025-01-31", 1), "2025-02-27");
});

test("calculateLeaseContractEndDate handles leap years and multi-year terms", () => {
  assert.equal(calculateLeaseContractAnniversaryDate("2024-02-29", 12), "2025-02-28");
  assert.equal(calculateLeaseContractEndDate("2024-02-29", 12), "2025-02-27");
  assert.equal(calculateLeaseContractEndDate("2024-02-29", 24), "2026-02-27");
  assert.equal(calculateLeaseContractEndDate("2025-08-31", 36), "2028-08-30");
});

test("getLeaseInstallmentPaymentOperationKey is deterministic per installment", () => {
  assert.equal(
    getLeaseInstallmentPaymentOperationKey("installment-1"),
    "lease-installment-payment:installment-1",
  );
  assert.equal(
    getLeaseInstallmentPaymentOperationKey("installment-1"),
    getLeaseInstallmentPaymentOperationKey("installment-1"),
  );
  assert.notEqual(
    getLeaseInstallmentPaymentOperationKey("installment-1"),
    getLeaseInstallmentPaymentOperationKey("installment-2"),
  );
  assert.throws(() => getLeaseInstallmentPaymentOperationKey("   "), /LEASE_INSTALLMENT_ID_REQUIRED/);
});

test("getLeaseInstallmentAlertKind emits each due-date state deterministically", () => {
  assert.equal(getLeaseInstallmentAlertKind("2026-09-18", "2026-09-15"), "due_soon");
  assert.equal(getLeaseInstallmentAlertKind("2026-09-18", "2026-09-18"), "due_today");
  assert.equal(getLeaseInstallmentAlertKind("2026-09-18", "2026-09-19"), "overdue");
  assert.equal(getLeaseInstallmentAlertKind("2026-09-20", "2026-09-15"), null);
});

test("calculateLeaseCoveredInstallmentWindow derives the last covered monthly period", () => {
  assert.deepEqual(
    calculateLeaseCoveredInstallmentWindow({
      contractStartDate: "2025-03-15",
      paidInstallments: 1,
    }),
    {
      paidInstallments: 1,
      coveredPeriodStartDate: "2025-03-15",
      coveredPeriodEndDate: "2025-04-14",
    },
  );

  assert.deepEqual(
    calculateLeaseCoveredInstallmentWindow({
      contractStartDate: "2025-03-15",
      paidInstallments: 15,
    }),
    {
      paidInstallments: 15,
      coveredPeriodStartDate: "2026-05-15",
      coveredPeriodEndDate: "2026-06-14",
    },
  );

  assert.deepEqual(
    calculateLeaseCoveredInstallmentWindow({
      contractStartDate: "2025-03-15",
      paidInstallments: 0,
    }),
    {
      paidInstallments: 0,
      coveredPeriodStartDate: null,
      coveredPeriodEndDate: null,
    },
  );
});

test("calculateLeaseOperationalMembershipWindow keeps overdue contracts expired without faking current coverage", () => {
  assert.deepEqual(
    calculateLeaseOperationalMembershipWindow({
      contractStartDate: "2024-01-01",
      paidInstallments: 20,
      today: "2026-08-17",
    }),
    {
      membershipStartDate: "2025-08-01",
      membershipEndDate: "2025-08-31",
      expiresAt: "2025-08-31",
      hasCoveredInstallments: true,
      isCurrentlyCovered: false,
    },
  );
});

test("calculateLeaseContractMetrics keeps overdue but not-yet-ended contracts active while operational coverage stays expired", () => {
  const metrics = calculateLeaseContractMetrics({
    contractStartDate: "2025-05-01",
    contractEndDate: "2027-04-30",
    contractTermMonths: 24,
    preWebcoolPaidInstallments: 14,
    webcoolPaidInstallments: 0,
    today: "2026-08-17",
  });

  assert.equal(metrics.elapsedCalendarMonths, 15);
  assert.equal(metrics.remainingCalendarMonths, 9);
  assert.equal(metrics.totalPaidInstallments, 14);
  assert.equal(metrics.pendingInstallments, 10);
  assert.equal(metrics.derivedStatus, "ACTIVE");

  assert.deepEqual(
    calculateLeaseOperationalMembershipWindow({
      contractStartDate: "2025-05-01",
      paidInstallments: metrics.totalPaidInstallments,
      today: "2026-08-17",
    }),
    {
      membershipStartDate: "2026-06-01",
      membershipEndDate: "2026-06-30",
      expiresAt: "2026-06-30",
      hasCoveredInstallments: true,
      isCurrentlyCovered: false,
    },
  );
});

test("calculateLeaseOperationalMembershipWindow marks unpaid migrated contracts as expired before coverage starts", () => {
  assert.deepEqual(
    calculateLeaseOperationalMembershipWindow({
      contractStartDate: "2024-01-01",
      paidInstallments: 0,
      today: "2026-08-17",
    }),
    {
      membershipStartDate: null,
      membershipEndDate: null,
      expiresAt: "2023-12-31",
      hasCoveredInstallments: false,
      isCurrentlyCovered: false,
    },
  );
});

test("calculateLeaseContractMetrics keeps advanced payments active when calendar still has time left", () => {
  const metrics = calculateLeaseContractMetrics({
    contractStartDate: "2025-01-15",
    contractEndDate: "2027-01-14",
    contractTermMonths: 24,
    preWebcoolPaidInstallments: 14,
    webcoolPaidInstallments: 0,
    today: "2025-11-15",
  });

  assert.equal(metrics.elapsedCalendarMonths, 10);
  assert.equal(metrics.remainingCalendarMonths, 14);
  assert.equal(metrics.totalPaidInstallments, 14);
  assert.equal(metrics.pendingInstallments, 10);
  assert.equal(metrics.paymentProgressPercent, 58);
  assert.equal(metrics.derivedStatus, "ACTIVE");
  assert.equal(metrics.isOpenForLifecycleGuards, true);
});

test("calculateLeaseContractMetrics marks early fully-paid contracts as completed", () => {
  const metrics = calculateLeaseContractMetrics({
    contractStartDate: "2025-01-15",
    contractEndDate: "2027-01-14",
    contractTermMonths: 24,
    preWebcoolPaidInstallments: 20,
    webcoolPaidInstallments: 4,
    today: "2026-07-15",
  });

  assert.equal(metrics.elapsedCalendarMonths, 18);
  assert.equal(metrics.remainingCalendarMonths, 6);
  assert.equal(metrics.totalPaidInstallments, 24);
  assert.equal(metrics.pendingInstallments, 0);
  assert.equal(metrics.paymentProgressPercent, 100);
  assert.equal(metrics.derivedStatus, "COMPLETED");
});

test("calculateLeaseContractMetrics marks overdue contracts with missing payments as expired", () => {
  const metrics = calculateLeaseContractMetrics({
    contractStartDate: "2025-01-15",
    contractEndDate: "2027-01-14",
    contractTermMonths: 24,
    preWebcoolPaidInstallments: 20,
    webcoolPaidInstallments: 0,
    today: "2027-02-01",
  });

  assert.equal(metrics.elapsedCalendarMonths, 24);
  assert.equal(metrics.remainingCalendarMonths, 0);
  assert.equal(metrics.totalPaidInstallments, 20);
  assert.equal(metrics.pendingInstallments, 4);
  assert.equal(metrics.paymentProgressPercent, 83);
  assert.equal(metrics.derivedStatus, "EXPIRED");
});

test("calculateLeaseContractMetrics keeps cancelled contracts cancelled even when fully paid", () => {
  const metrics = calculateLeaseContractMetrics({
    contractStartDate: "2025-01-15",
    contractEndDate: "2027-01-14",
    contractTermMonths: 24,
    preWebcoolPaidInstallments: 24,
    webcoolPaidInstallments: 0,
    today: "2026-08-16",
    cancelledAt: "2026-08-01T12:00:00.000Z",
  });

  assert.equal(metrics.totalPaidInstallments, 24);
  assert.equal(metrics.pendingInstallments, 0);
  assert.equal(metrics.derivedStatus, "CANCELLED");
  assert.equal(metrics.isOpenForLifecycleGuards, false);
});

test("calculateLeaseContractMetrics clamps pending payments at zero when paid count exceeds term", () => {
  const metrics = calculateLeaseContractMetrics({
    contractStartDate: "2025-01-15",
    contractEndDate: "2027-01-14",
    contractTermMonths: 24,
    preWebcoolPaidInstallments: 14,
    webcoolPaidInstallments: 12,
    today: "2026-08-16",
  });

  assert.equal(metrics.totalPaidInstallments, 24);
  assert.equal(metrics.pendingInstallments, 0);
  assert.equal(metrics.paymentProgressPercent, 100);
  assert.equal(metrics.derivedStatus, "COMPLETED");
});

test("calculateLeaseQuote handles tax exempt quotes with exact cent distribution", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    clientUserId: "client-1",
    leasedItemDescription: "Mazda 3 Hatchback",
  }));

  assert.equal(quote.assetSubtotalBeforeTaxCents, 10_000_000);
  assert.equal(quote.assetTaxableSubtotalCents, 10_000_000);
  assert.equal(quote.assetTaxCents, 0);
  assert.equal(quote.downPaymentEnabled, false);
  assert.equal(quote.downPaymentFinalTotalCents, 0);
  assert.equal(quote.financedPrincipalBeforeTaxCents, 10_000_000);
  assert.equal(quote.surchargeTotalCents, 2_000_000);
  assert.equal(quote.financedSubtotalBeforeTaxCents, 12_000_000);
  assert.equal(quote.contractTaxTotalCents, 0);
  assert.equal(quote.financedFinalTotalCents, 12_000_000);
  assert.equal(quote.contractFinalTotalCents, 12_000_000);
  assert.equal(quote.contractEndDate, "2028-08-17");
  assert.equal(quote.installmentRows.length, 24);
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.subtotalBeforeTaxCents, 0),
    12_000_000,
  );
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.taxTotalCents, 0),
    0,
  );
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.finalTotalCents, 0),
    12_000_000,
  );
});

test("calculateLeaseQuote handles tax added quotes", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    clientUserId: "client-2",
    taxMode: "tax_added",
    taxRate: 16,
    notes: "",
  }));

  assert.equal(quote.assetSubtotalBeforeTaxCents, 10_000_000);
  assert.equal(quote.assetTaxCents, 1_600_000);
  assert.equal(quote.financedPrincipalBeforeTaxCents, 10_000_000);
  assert.equal(quote.surchargeTotalCents, 2_000_000);
  assert.equal(quote.financedSubtotalBeforeTaxCents, 12_000_000);
  assert.equal(quote.contractTaxTotalCents, 1_920_000);
  assert.equal(quote.financedFinalTotalCents, 13_920_000);
  assert.equal(quote.contractFinalTotalCents, 13_920_000);
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.subtotalBeforeTaxCents, 0),
    12_000_000,
  );
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.taxTotalCents, 0),
    1_920_000,
  );
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.finalTotalCents, 0),
    13_920_000,
  );
});

test("calculateLeaseQuote handles tax included quotes by computing surcharge over the pre-tax base", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    clientUserId: "client-3",
    capturedAssetValueCents: 11_600_000,
    taxMode: "tax_included",
    taxRate: 16,
    notes: "",
  }));

  assert.equal(quote.assetSubtotalBeforeTaxCents, 10_000_000);
  assert.equal(quote.assetTaxCents, 1_600_000);
  assert.equal(quote.assetFinalTotalCents, 11_600_000);
  assert.equal(quote.surchargeTotalCents, 2_000_000);
  assert.equal(quote.financedSubtotalBeforeTaxCents, 12_000_000);
  assert.equal(quote.contractTaxTotalCents, 1_920_000);
  assert.equal(quote.contractFinalTotalCents, 13_920_000);
});

test("calculateLeaseQuote keeps every cent when totals do not divide evenly", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    clientUserId: "client-4",
    termMonths: 36,
    surchargeRate: 0,
  }));

  assert.equal(quote.approximateInstallmentFinalTotalCents, 277_777);
  assert.equal(quote.finalInstallmentFinalTotalCents, 277_805);
  assert.equal(quote.hasAdjustedFinalInstallment, true);
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.finalTotalCents, 0),
    10_000_000,
  );
});

test("calculateLeaseQuote keeps due dates aligned when the contract starts on January 31", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    clientUserId: "client-5",
    startDate: "2026-01-31",
    termMonths: 4,
    capturedAssetValueCents: 1_000_000,
    surchargeRate: 0,
  }));

  assert.deepEqual(
    quote.installmentRows.map((row) => row.dueDate),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"],
  );
});

test("calculateLeaseQuote handles leap-year starts on February 29", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    clientUserId: "client-6",
    startDate: "2024-02-29",
    termMonths: 4,
    capturedAssetValueCents: 1_000_000,
    surchargeRate: 0,
  }));

  assert.deepEqual(
    quote.installmentRows.map((row) => row.dueDate),
    ["2024-02-29", "2024-03-29", "2024-04-29", "2024-05-29"],
  );
});

test("calculateLeaseQuote supports long custom terms", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    clientUserId: "client-7",
    termMonths: 60,
    capturedAssetValueCents: 5_000_000,
    surchargeRate: 10,
    taxMode: "tax_added",
    taxRate: 16,
    notes: "Plazo personalizado",
  }));

  assert.equal(quote.installmentRows.length, 60);
  assert.equal(quote.contractEndDate, "2031-08-17");
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.subtotalBeforeTaxCents, 0),
    quote.financedSubtotalBeforeTaxCents,
  );
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.taxTotalCents, 0),
    quote.contractTaxTotalCents,
  );
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.finalTotalCents, 0),
    quote.contractFinalTotalCents,
  );
});

test("calculateLeaseQuote handles a fixed down payment amount before applying surcharge", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    capturedAssetValueCents: 10_000_000,
    surchargeRate: 20,
    downPaymentEnabled: true,
    downPaymentType: "amount",
    downPaymentAmountCents: 2_000_000,
  }));

  assert.equal(quote.downPaymentType, "amount");
  assert.equal(quote.downPaymentSubtotalBeforeTaxCents, 2_000_000);
  assert.equal(quote.downPaymentTaxCents, 0);
  assert.equal(quote.downPaymentFinalTotalCents, 2_000_000);
  assert.equal(quote.financedPrincipalBeforeTaxCents, 8_000_000);
  assert.equal(quote.surchargeTotalCents, 1_600_000);
  assert.equal(quote.financedSubtotalBeforeTaxCents, 9_600_000);
  assert.equal(quote.financedFinalTotalCents, 9_600_000);
  assert.equal(quote.contractFinalTotalCents, 11_600_000);
});

test("calculateLeaseQuote handles a percentage down payment with tax added", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    capturedAssetValueCents: 10_000_000,
    surchargeRate: 20,
    downPaymentEnabled: true,
    downPaymentType: "percentage",
    downPaymentRate: 20,
    taxMode: "tax_added",
    taxRate: 16,
  }));

  assert.equal(quote.downPaymentType, "percentage");
  assert.equal(quote.downPaymentRate, 20);
  assert.equal(quote.downPaymentSubtotalBeforeTaxCents, 2_000_000);
  assert.equal(quote.downPaymentTaxCents, 320_000);
  assert.equal(quote.downPaymentFinalTotalCents, 2_320_000);
  assert.equal(quote.financedPrincipalBeforeTaxCents, 8_000_000);
  assert.equal(quote.surchargeTotalCents, 1_600_000);
  assert.equal(quote.financedSubtotalBeforeTaxCents, 9_600_000);
  assert.equal(quote.contractTaxTotalCents, 1_536_000);
  assert.equal(quote.financedFinalTotalCents, 11_136_000);
  assert.equal(quote.contractFinalTotalCents, 13_456_000);
});

test("calculateLeaseQuote handles a fixed down payment amount with tax included", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    capturedAssetValueCents: 11_600_000,
    surchargeRate: 20,
    downPaymentEnabled: true,
    downPaymentType: "amount",
    downPaymentAmountCents: 2_320_000,
    taxMode: "tax_included",
    taxRate: 16,
  }));

  assert.equal(quote.assetSubtotalBeforeTaxCents, 10_000_000);
  assert.equal(quote.downPaymentSubtotalBeforeTaxCents, 2_000_000);
  assert.equal(quote.downPaymentTaxCents, 320_000);
  assert.equal(quote.downPaymentFinalTotalCents, 2_320_000);
  assert.equal(quote.financedPrincipalBeforeTaxCents, 8_000_000);
  assert.equal(quote.financedFinalTotalCents, 11_136_000);
  assert.equal(quote.contractFinalTotalCents, 13_456_000);
});

test("calculateLeaseQuote rejects a 100 percent down payment because nothing remains to finance", () => {
  assert.throws(() => calculateLeaseQuote(buildQuoteInput({
    downPaymentEnabled: true,
    downPaymentType: "percentage",
    downPaymentRate: 100,
  })), /DOWN_PAYMENT_MUST_LEAVE_FINANCED_BALANCE/);
});

test("calculateLeaseQuote rejects a down payment greater than the captured asset value", () => {
  assert.throws(() => calculateLeaseQuote(buildQuoteInput({
    downPaymentEnabled: true,
    downPaymentType: "amount",
    downPaymentAmountCents: 10_000_001,
  })), /DOWN_PAYMENT_MUST_LEAVE_FINANCED_BALANCE/);
});

test("calculateLeaseQuote preserves exact totals with large figures and down payment", () => {
  const quote = calculateLeaseQuote(buildQuoteInput({
    capturedAssetValueCents: 5_000_000_000,
    surchargeRate: 18.5,
    termMonths: 60,
    downPaymentEnabled: true,
    downPaymentType: "percentage",
    downPaymentRate: 15,
    taxMode: "tax_added",
    taxRate: 16,
  }));

  assert.equal(quote.installmentRows.length, 60);
  assert.equal(quote.downPaymentSubtotalBeforeTaxCents, 750_000_000);
  assert.equal(quote.financedPrincipalBeforeTaxCents, 4_250_000_000);
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.subtotalBeforeTaxCents, 0),
    quote.financedSubtotalBeforeTaxCents,
  );
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.taxTotalCents, 0),
    quote.contractTaxTotalCents,
  );
  assert.equal(
    quote.installmentRows.reduce((sum, row) => sum + row.finalTotalCents, 0),
    quote.financedFinalTotalCents,
  );
  assert.equal(
    quote.contractFinalTotalCents,
    quote.financedFinalTotalCents + quote.downPaymentFinalTotalCents,
  );
});
