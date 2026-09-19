import test from "node:test";
import assert from "node:assert/strict";

import {
  addPlanDuration,
  calculateRenewalCoverage,
  classifyEffectivePaymentDate,
  createMembershipCoverageSnapshot,
  getCompatibilityDurationFields,
  getPlanDurationSnapshot,
  isSingleSessionPlan,
  isValidPlanDuration,
  parsePlanDateOnly,
} from "./membership-plan-duration";
import {
  getMembershipBillingRequestFingerprint,
  matchesMembershipBillingRequestFingerprint,
} from "./membership-billing-operation";

const legacyMonthly = { cycleMonths: 1, durationDays: 30, durationUnit: null, durationValue: null };
const legacySingle = { cycleMonths: 0, durationDays: 1, durationUnit: null, durationValue: null };

function date(value: Date | null) {
  return value?.toISOString().slice(0, 10);
}

test("legacy monthly and single-session plans retain their duration", () => {
  assert.equal(date(addPlanDuration(legacyMonthly, parsePlanDateOnly("2026-01-31")!)), "2026-02-28");
  assert.equal(date(addPlanDuration(legacySingle, parsePlanDateOnly("2026-09-18")!)), "2026-09-19");
  assert.equal(isSingleSessionPlan(legacySingle), true);
  assert.equal(isSingleSessionPlan(legacyMonthly), false);
  assert.deepEqual(getPlanDurationSnapshot(legacyMonthly), { unit: "month", value: 1 });
});

test("weekly plans cover exact 7-day multiples and never look like a single session", () => {
  for (const [weeks, expected] of [[1, "2026-09-25"], [2, "2026-10-02"], [3, "2026-10-09"]] as const) {
    const plan = { ...getCompatibilityDurationFields("week", weeks), durationUnit: "week", durationValue: weeks };
    assert.equal(date(addPlanDuration(plan, parsePlanDateOnly("2026-09-18")!)), expected);
    assert.equal(isSingleSessionPlan(plan), false);
    assert.equal(plan.cycleMonths, 1);
  }
  assert.equal(isValidPlanDuration("week", 156), true);
  assert.equal(isValidPlanDuration("week", 157), false);
  assert.equal(isValidPlanDuration("day", 2), false);
  assert.equal(isValidPlanDuration("month", 37), false);
  assert.equal(isValidPlanDuration("year", 4), false);
});

test("calendar month and leap-year additions clamp at month end", () => {
  const month = { cycleMonths: 1, durationUnit: "month", durationValue: 1 };
  const year = { cycleMonths: 12, durationUnit: "year", durationValue: 1 };
  assert.equal(date(addPlanDuration(month, parsePlanDateOnly("2026-01-31")!)), "2026-02-28");
  assert.equal(date(addPlanDuration(month, parsePlanDateOnly("2024-01-31")!)), "2024-02-29");
  assert.equal(date(addPlanDuration(year, parsePlanDateOnly("2024-02-29")!)), "2025-02-28");
});

test("renewal starts at the later of previous expiration and real payment date", () => {
  const plan = { cycleMonths: 1, durationUnit: "month", durationValue: 1 };
  const expired = calculateRenewalCoverage(plan, "2026-09-13T12:00:00.000Z", "2026-09-13");
  const late = calculateRenewalCoverage(plan, "2026-09-13T12:00:00.000Z", "2026-09-18");
  const early = calculateRenewalCoverage(plan, "2026-09-30T12:00:00.000Z", "2026-09-25");
  assert.equal(date(expired!.coverageStart), "2026-09-13");
  assert.equal(date(expired!.coverageEnd), "2026-10-13");
  assert.equal(date(late!.coverageStart), "2026-09-18");
  assert.equal(date(late!.coverageEnd), "2026-10-18");
  assert.equal(date(early!.coverageStart), "2026-09-30");
  assert.equal(date(early!.coverageEnd), "2026-10-30");
  const again = calculateRenewalCoverage(plan, early!.coverageEnd, "2026-09-25");
  assert.equal(date(again!.coverageEnd), "2026-11-30");
  assert.equal(calculateRenewalCoverage(plan, null, "2026-02-30"), null);
  assert.equal(classifyEffectivePaymentDate("2026-09-19", "2026-09-18"), "future");
  assert.equal(classifyEffectivePaymentDate("2026-09-18", "2026-09-18"), "valid");
  assert.equal(classifyEffectivePaymentDate("2026-02-30", "2026-09-18"), "invalid");
});

test("billing fingerprint rejects changed payment date, method, plan, or branch", () => {
  const request = {
    branchId: "branch-a",
    membershipId: "membership-a",
    planId: "plan-a",
    eventType: "renew" as const,
    paymentEffectiveDate: "2026-09-13",
    paymentMethod: "transferencia",
  };
  const fingerprint = getMembershipBillingRequestFingerprint(request);
  assert.equal(matchesMembershipBillingRequestFingerprint({ requestFingerprint: fingerprint }, fingerprint), true);
  assert.notEqual(getMembershipBillingRequestFingerprint({ ...request, paymentEffectiveDate: "2026-09-18" }), fingerprint);
  assert.notEqual(getMembershipBillingRequestFingerprint({ ...request, paymentMethod: "efectivo" }), fingerprint);
  assert.notEqual(getMembershipBillingRequestFingerprint({ ...request, planId: "plan-b" }), fingerprint);
  assert.notEqual(getMembershipBillingRequestFingerprint({ ...request, branchId: "branch-b" }), fingerprint);
});

test("new assignment and renewal snapshots are complete and reject incomplete coverage", () => {
  const plan = { cycleMonths: 1, durationUnit: "week", durationValue: 2 };
  const start = parsePlanDateOnly("2026-09-18")!;
  const end = addPlanDuration(plan, start);
  assert.deepEqual(createMembershipCoverageSnapshot(plan, "2026-09-18", start, end), {
    paymentEffectiveDate: "2026-09-18",
    coverageStartAt: start,
    coverageEndAt: end,
    durationUnitSnapshot: "week",
    durationValueSnapshot: 2,
  });
  assert.throws(() => createMembershipCoverageSnapshot(plan, "2026-09-18", start, start), /MEMBERSHIP_COVERAGE_SNAPSHOT_INVALID/);
  assert.throws(() => createMembershipCoverageSnapshot(plan, "2026-02-30", start, end), /MEMBERSHIP_COVERAGE_SNAPSHOT_INVALID/);
});
