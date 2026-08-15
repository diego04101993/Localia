export const membershipPlanTaxModeValues = [
  "tax_included",
  "tax_added",
  "tax_exempt",
] as const;

export type MembershipPlanTaxMode = (typeof membershipPlanTaxModeValues)[number];

export type MembershipPlanResolvedTaxConfig =
  | {
      isLegacy: true;
      taxMode: null;
      taxRate: null;
    }
  | {
      isLegacy: false;
      taxMode: MembershipPlanTaxMode;
      taxRate: number;
    };

export type MembershipPlanChargeSnapshot = {
  isLegacy: boolean;
  taxMode: MembershipPlanTaxMode | null;
  taxRate: number | null;
  basePriceCents: number;
  subtotalBeforeTaxCents: number | null;
  taxableSubtotalCents: number | null;
  taxTotalCents: number | null;
  finalTotalCents: number;
};

const RATE_SCALE = 10_000;
const RATE_DENOMINATOR = 100 * RATE_SCALE;

function roundDiv(numerator: number, denominator: number) {
  if (denominator <= 0) {
    throw new Error("INVALID_TAX_DENOMINATOR");
  }
  return Math.floor((numerator + denominator / 2) / denominator);
}

function normalizeNonNegativeInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("INVALID_PRICE_CENTS");
  }
  return Math.round(parsed);
}

function normalizeRateNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("INVALID_TAX_RATE");
  }
  const rounded = Math.round(Math.max(0, parsed) * RATE_SCALE) / RATE_SCALE;
  if (rounded > 100) {
    throw new Error("INVALID_TAX_RATE_RANGE");
  }
  return rounded;
}

function toScaledRate(rate: number) {
  return Math.round(rate * RATE_SCALE);
}

export function isMembershipPlanTaxMode(value: unknown): value is MembershipPlanTaxMode {
  return typeof value === "string" && membershipPlanTaxModeValues.includes(value as MembershipPlanTaxMode);
}

export function resolveMembershipPlanTaxConfig(input: {
  taxMode?: unknown;
  taxRate?: unknown;
}): MembershipPlanResolvedTaxConfig {
  const rawMode = input.taxMode == null || input.taxMode === "" ? null : input.taxMode;

  if (rawMode == null) {
    const rawRate = normalizeRateNumber(input.taxRate);
    if (rawRate != null) {
      throw new Error("TAX_MODE_REQUIRED");
    }
    return {
      isLegacy: true,
      taxMode: null,
      taxRate: null,
    };
  }

  if (!isMembershipPlanTaxMode(rawMode)) {
    throw new Error("INVALID_TAX_MODE");
  }

  if (rawMode === "tax_exempt") {
    const rawRate = normalizeRateNumber(input.taxRate);
    if (rawRate != null && rawRate !== 0) {
      throw new Error("TAX_RATE_NOT_ALLOWED_FOR_TAX_EXEMPT");
    }

    return {
      isLegacy: false,
      taxMode: "tax_exempt",
      taxRate: 0,
    };
  }

  const taxRate = normalizeRateNumber(input.taxRate);
  if (taxRate == null) {
    throw new Error("TAX_RATE_REQUIRED");
  }
  if (taxRate <= 0) {
    throw new Error("TAX_RATE_MUST_BE_POSITIVE");
  }

  return {
    isLegacy: false,
    taxMode: rawMode,
    taxRate,
  };
}

export function computeMembershipPlanChargeSnapshot(params: {
  priceCents: unknown;
  taxMode?: unknown;
  taxRate?: unknown;
}): MembershipPlanChargeSnapshot {
  const basePriceCents = normalizeNonNegativeInteger(params.priceCents);
  const config = resolveMembershipPlanTaxConfig({
    taxMode: params.taxMode,
    taxRate: params.taxRate,
  });

  if (config.isLegacy) {
    return {
      isLegacy: true,
      taxMode: null,
      taxRate: null,
      basePriceCents,
      subtotalBeforeTaxCents: null,
      taxableSubtotalCents: null,
      taxTotalCents: null,
      finalTotalCents: basePriceCents,
    };
  }

  if (config.taxMode === "tax_exempt" || config.taxRate <= 0) {
    return {
      isLegacy: false,
      taxMode: "tax_exempt",
      taxRate: 0,
      basePriceCents,
      subtotalBeforeTaxCents: basePriceCents,
      taxableSubtotalCents: basePriceCents,
      taxTotalCents: 0,
      finalTotalCents: basePriceCents,
    };
  }

  const scaledRate = toScaledRate(config.taxRate);

  if (config.taxMode === "tax_included") {
    const subtotalBeforeTaxCents = roundDiv(
      basePriceCents * RATE_DENOMINATOR,
      RATE_DENOMINATOR + scaledRate,
    );
    const taxTotalCents = Math.max(0, basePriceCents - subtotalBeforeTaxCents);

    return {
      isLegacy: false,
      taxMode: "tax_included",
      taxRate: config.taxRate,
      basePriceCents,
      subtotalBeforeTaxCents,
      taxableSubtotalCents: subtotalBeforeTaxCents,
      taxTotalCents,
      finalTotalCents: basePriceCents,
    };
  }

  const taxTotalCents = roundDiv(basePriceCents * scaledRate, RATE_DENOMINATOR);
  return {
    isLegacy: false,
    taxMode: "tax_added",
    taxRate: config.taxRate,
    basePriceCents,
    subtotalBeforeTaxCents: basePriceCents,
    taxableSubtotalCents: basePriceCents,
    taxTotalCents,
    finalTotalCents: basePriceCents + taxTotalCents,
  };
}
