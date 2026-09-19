export type PlanDurationUnit = "day" | "week" | "month" | "year";

export type PlanDurationFields = {
  durationUnit?: string | null;
  durationValue?: number | null;
  cycleMonths: number | null;
  durationDays?: number | null;
};

export type ResolvedPlanDuration = {
  unit: PlanDurationUnit;
  value: number;
  legacy: boolean;
  singleSession: boolean;
};

const durationLimits: Record<PlanDurationUnit, { min: number; max: number }> = {
  day: { min: 1, max: 1 },
  week: { min: 1, max: 156 },
  month: { min: 1, max: 36 },
  year: { min: 1, max: 3 },
};

export function isValidPlanDuration(unit: string, value: number): unit is PlanDurationUnit {
  if (!(unit in durationLimits) || !Number.isInteger(value)) return false;
  const { min, max } = durationLimits[unit as PlanDurationUnit];
  return value >= min && value <= max;
}

export function resolvePlanDuration(plan: PlanDurationFields): ResolvedPlanDuration {
  if (plan.durationUnit == null && plan.durationValue == null) {
    const months = plan.cycleMonths ?? 1;
    if (months === 0) {
      return {
        unit: "day",
        value: Math.max(plan.durationDays ?? 1, 1),
        legacy: true,
        singleSession: true,
      };
    }
    return { unit: "month", value: months, legacy: true, singleSession: false };
  }

  if (plan.durationUnit == null || plan.durationValue == null || !isValidPlanDuration(plan.durationUnit, plan.durationValue)) {
    throw new Error("PLAN_DURATION_INVALID");
  }

  return {
    unit: plan.durationUnit,
    value: plan.durationValue,
    legacy: false,
    singleSession: plan.durationUnit === "day",
  };
}

export function getPlanDurationSnapshot(plan: PlanDurationFields): { unit: PlanDurationUnit; value: number } {
  const { unit, value } = resolvePlanDuration(plan);
  if (!isValidPlanDuration(unit, value)) {
    throw new Error("PLAN_DURATION_SNAPSHOT_UNSUPPORTED");
  }
  return { unit, value };
}

export function createMembershipCoverageSnapshot(
  plan: PlanDurationFields,
  paymentEffectiveDate: string,
  coverageStartAt: Date,
  coverageEndAt: Date,
) {
  if (!parsePlanDateOnly(paymentEffectiveDate) || !Number.isFinite(coverageStartAt.getTime())
    || !Number.isFinite(coverageEndAt.getTime()) || coverageEndAt <= coverageStartAt) {
    throw new Error("MEMBERSHIP_COVERAGE_SNAPSHOT_INVALID");
  }
  const duration = getPlanDurationSnapshot(plan);
  return {
    paymentEffectiveDate,
    coverageStartAt,
    coverageEndAt,
    durationUnitSnapshot: duration.unit,
    durationValueSnapshot: duration.value,
  };
}

export function getCompatibilityDurationFields(unit: PlanDurationUnit, value: number): { cycleMonths: number; durationDays: number } {
  if (!isValidPlanDuration(unit, value)) throw new Error("PLAN_DURATION_INVALID");
  if (unit === "day") return { cycleMonths: 0, durationDays: 1 };
  if (unit === "week") return { cycleMonths: 1, durationDays: value * 7 };
  if (unit === "year") return { cycleMonths: value * 12, durationDays: value * 365 };
  return { cycleMonths: value, durationDays: value * 30 };
}

export function isSingleSessionPlan(plan: PlanDurationFields): boolean {
  return resolvePlanDuration(plan).singleSession;
}

export function getPlanDurationLabel(plan: PlanDurationFields): string {
  const { unit, value, singleSession } = resolvePlanDuration(plan);
  if (singleSession) return "Clase suelta";
  if (unit === "week") return `${value} ${value === 1 ? "semana" : "semanas"}`;
  if (unit === "year") return value === 1 ? "Anual" : `${value} años`;
  if (value === 1) return "Mensual";
  if (value === 3) return "Trimestral";
  if (value === 6) return "Semestral";
  if (value === 12) return "Anual";
  return `${value} meses`;
}

function addMonthsClamped(date: Date, months: number, utc: boolean): Date {
  const result = new Date(date);
  const day = utc ? result.getUTCDate() : result.getDate();
  if (utc) {
    result.setUTCMonth(result.getUTCMonth() + months);
    if (result.getUTCDate() !== day) result.setUTCDate(0);
  } else {
    result.setMonth(result.getMonth() + months);
    if (result.getDate() !== day) result.setDate(0);
  }
  return result;
}

export function addPlanDuration(plan: PlanDurationFields, from: Date, legacyClock: "local" | "utc" = "utc"): Date {
  const duration = resolvePlanDuration(plan);
  const result = new Date(from);
  if (duration.legacy && legacyClock === "local") {
    if (duration.unit === "day") result.setDate(result.getDate() + duration.value);
    else return addMonthsClamped(result, duration.value, false);
    return result;
  }
  if (duration.unit === "day" || duration.unit === "week") {
    result.setUTCDate(result.getUTCDate() + duration.value * (duration.unit === "week" ? 7 : 1));
    return result;
  }
  return addMonthsClamped(result, duration.value * (duration.unit === "year" ? 12 : 1), true);
}

export function parsePlanDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? parsed
    : null;
}

export function classifyEffectivePaymentDate(value: string, today: string): "valid" | "invalid" | "future" {
  if (!parsePlanDateOnly(value)) return "invalid";
  return value > today ? "future" : "valid";
}

export function calculateRenewalCoverage(
  plan: PlanDurationFields,
  currentExpiration: Date | string | null,
  effectivePaymentDate: string,
): { paymentAt: Date; coverageStart: Date; coverageEnd: Date } | null {
  const paymentAt = parsePlanDateOnly(effectivePaymentDate);
  if (!paymentAt) return null;
  const expiration = currentExpiration == null ? null : new Date(currentExpiration);
  if (expiration && Number.isNaN(expiration.getTime())) return null;
  const coverageStart = expiration && expiration > paymentAt ? expiration : paymentAt;
  return {
    paymentAt,
    coverageStart,
    coverageEnd: addPlanDuration(plan, coverageStart, "local"),
  };
}
