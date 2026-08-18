import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateLeaseContractAnniversaryDate,
  calculateLeaseCoveredInstallmentWindow,
  calculateLeaseContractEndDate,
  calculateLeaseContractMetrics,
  calculateLeaseOperationalMembershipWindow,
} from "./lease-contract";

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
