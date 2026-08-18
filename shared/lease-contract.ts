export const leaseContractDerivedStatusValues = [
  "ACTIVE",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type LeaseContractDerivedStatus = (typeof leaseContractDerivedStatusValues)[number];

export type LeaseContractMetricsInput = {
  contractStartDate: string;
  contractEndDate: string;
  contractTermMonths: number;
  preWebcoolPaidInstallments: number;
  webcoolPaidInstallments: number;
  today: string;
  cancelledAt?: string | null;
  completedAt?: string | null;
};

export type LeaseContractMetrics = {
  elapsedCalendarMonths: number;
  remainingCalendarMonths: number;
  preWebcoolPaidInstallments: number;
  webcoolPaidInstallments: number;
  totalPaidInstallments: number;
  pendingInstallments: number;
  paymentProgressPercent: number;
  derivedStatus: LeaseContractDerivedStatus;
  isOpenForLifecycleGuards: boolean;
};

export type LeaseCoveredInstallmentWindow = {
  paidInstallments: number;
  coveredPeriodStartDate: string | null;
  coveredPeriodEndDate: string | null;
};

export type LeaseOperationalMembershipWindow = {
  membershipStartDate: string | null;
  membershipEndDate: string | null;
  expiresAt: string;
  hasCoveredInstallments: boolean;
  isCurrentlyCovered: boolean;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}`);
  }
  return value;
}

function normalizePositiveInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}`);
  }
  return value;
}

export function parseLeaseContractIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatLeaseContractIsoDate(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
}

export function addCalendarMonthsClamped(from: Date, months: number): Date {
  const normalizedMonths = normalizeNonNegativeInteger(months, "months");
  if (normalizedMonths === 0) {
    return new Date(from.getTime());
  }

  const result = new Date(from.getTime());
  const dayOfMonth = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + normalizedMonths);
  if (result.getUTCDate() !== dayOfMonth) {
    result.setUTCDate(0);
  }
  return result;
}

export function calculateLeaseContractAnniversaryDate(startDate: string, months: number): string | null {
  const parsed = parseLeaseContractIsoDate(startDate);
  if (!parsed) return null;
  const normalizedMonths = normalizeNonNegativeInteger(months, "months");
  return formatLeaseContractIsoDate(addCalendarMonthsClamped(parsed, normalizedMonths));
}

export function calculateLeaseContractEndDate(startDate: string, termMonths: number): string | null {
  const parsed = parseLeaseContractIsoDate(startDate);
  if (!parsed) return null;
  const normalizedTermMonths = normalizePositiveInteger(termMonths, "contract_term_months");
  const contractEnd = addCalendarMonthsClamped(parsed, normalizedTermMonths);
  contractEnd.setUTCDate(contractEnd.getUTCDate() - 1);
  return formatLeaseContractIsoDate(contractEnd);
}

export function calculateLeaseCoveredInstallmentWindow(params: {
  contractStartDate: string;
  paidInstallments: number;
}): LeaseCoveredInstallmentWindow {
  const start = parseLeaseContractIsoDate(params.contractStartDate);
  if (!start) {
    throw new Error("INVALID_CONTRACT_DATE");
  }

  const paidInstallments = normalizeNonNegativeInteger(params.paidInstallments, "paid_installments");
  if (paidInstallments === 0) {
    return {
      paidInstallments,
      coveredPeriodStartDate: null,
      coveredPeriodEndDate: null,
    };
  }

  const coveredPeriodStart = addCalendarMonthsClamped(start, paidInstallments - 1);
  const coveredPeriodEnd = addCalendarMonthsClamped(start, paidInstallments);
  coveredPeriodEnd.setUTCDate(coveredPeriodEnd.getUTCDate() - 1);

  return {
    paidInstallments,
    coveredPeriodStartDate: formatLeaseContractIsoDate(coveredPeriodStart),
    coveredPeriodEndDate: formatLeaseContractIsoDate(coveredPeriodEnd),
  };
}

export function calculateLeaseOperationalMembershipWindow(params: {
  contractStartDate: string;
  paidInstallments: number;
  today: string;
}): LeaseOperationalMembershipWindow {
  const contractStart = parseLeaseContractIsoDate(params.contractStartDate);
  const today = parseLeaseContractIsoDate(params.today);
  if (!contractStart || !today) {
    throw new Error("INVALID_CONTRACT_DATE");
  }

  const coverageWindow = calculateLeaseCoveredInstallmentWindow({
    contractStartDate: params.contractStartDate,
    paidInstallments: params.paidInstallments,
  });

  if (!coverageWindow.coveredPeriodStartDate || !coverageWindow.coveredPeriodEndDate) {
    const preCoverageExpiry = new Date(contractStart.getTime());
    preCoverageExpiry.setUTCDate(preCoverageExpiry.getUTCDate() - 1);
    return {
      membershipStartDate: null,
      membershipEndDate: null,
      expiresAt: formatLeaseContractIsoDate(preCoverageExpiry),
      hasCoveredInstallments: false,
      isCurrentlyCovered: false,
    };
  }

  return {
    membershipStartDate: coverageWindow.coveredPeriodStartDate,
    membershipEndDate: coverageWindow.coveredPeriodEndDate,
    expiresAt: coverageWindow.coveredPeriodEndDate,
    hasCoveredInstallments: true,
    isCurrentlyCovered: coverageWindow.coveredPeriodEndDate >= formatLeaseContractIsoDate(today),
  };
}

export function isLeaseContractOpenForLifecycleGuards(params: {
  cancelledAt?: string | null;
  completedAt?: string | null;
}): boolean {
  return !params.cancelledAt && !params.completedAt;
}

export function calculateElapsedCalendarMonths(params: {
  contractStartDate: string;
  contractTermMonths: number;
  today: string;
}): number {
  const start = parseLeaseContractIsoDate(params.contractStartDate);
  const today = parseLeaseContractIsoDate(params.today);
  const termMonths = normalizePositiveInteger(params.contractTermMonths, "contract_term_months");

  if (!start || !today) {
    throw new Error("INVALID_CONTRACT_DATE");
  }

  if (today.getTime() < start.getTime()) {
    return 0;
  }

  let elapsed = 0;
  for (let month = 1; month <= termMonths; month += 1) {
    const anniversary = addCalendarMonthsClamped(start, month);
    if (anniversary.getTime() <= today.getTime()) {
      elapsed = month;
      continue;
    }
    break;
  }

  return elapsed;
}

export function deriveLeaseContractStatus(input: LeaseContractMetricsInput): LeaseContractDerivedStatus {
  if (input.cancelledAt) {
    return "CANCELLED";
  }

  const totalPaidInstallments = Math.min(
    normalizePositiveInteger(input.contractTermMonths, "contract_term_months"),
    normalizeNonNegativeInteger(input.preWebcoolPaidInstallments, "pre_webcool_paid_installments")
      + normalizeNonNegativeInteger(input.webcoolPaidInstallments, "webcool_paid_installments"),
  );

  if (input.completedAt || totalPaidInstallments >= input.contractTermMonths) {
    return "COMPLETED";
  }

  const contractEnd = parseLeaseContractIsoDate(input.contractEndDate);
  const today = parseLeaseContractIsoDate(input.today);
  if (!contractEnd || !today) {
    throw new Error("INVALID_CONTRACT_DATE");
  }

  if (today.getTime() > contractEnd.getTime()) {
    return "EXPIRED";
  }

  return "ACTIVE";
}

export function calculateLeaseContractMetrics(input: LeaseContractMetricsInput): LeaseContractMetrics {
  const contractTermMonths = normalizePositiveInteger(input.contractTermMonths, "contract_term_months");
  const preWebcoolPaidInstallments = normalizeNonNegativeInteger(
    input.preWebcoolPaidInstallments,
    "pre_webcool_paid_installments",
  );
  const webcoolPaidInstallments = normalizeNonNegativeInteger(
    input.webcoolPaidInstallments,
    "webcool_paid_installments",
  );

  const elapsedCalendarMonths = calculateElapsedCalendarMonths({
    contractStartDate: input.contractStartDate,
    contractTermMonths,
    today: input.today,
  });
  const remainingCalendarMonths = Math.max(contractTermMonths - elapsedCalendarMonths, 0);
  const totalPaidInstallments = Math.min(contractTermMonths, preWebcoolPaidInstallments + webcoolPaidInstallments);
  const pendingInstallments = Math.max(contractTermMonths - totalPaidInstallments, 0);
  const paymentProgressPercent = Math.min(
    100,
    Math.max(0, Math.round((totalPaidInstallments / contractTermMonths) * 100)),
  );

  return {
    elapsedCalendarMonths,
    remainingCalendarMonths,
    preWebcoolPaidInstallments,
    webcoolPaidInstallments,
    totalPaidInstallments,
    pendingInstallments,
    paymentProgressPercent,
    derivedStatus: deriveLeaseContractStatus(input),
    isOpenForLifecycleGuards: isLeaseContractOpenForLifecycleGuards(input),
  };
}
