export type CommercialTaxMode = "tax_included" | "tax_added" | "tax_exempt";

export type CommercialSaleFiscalSnapshotInput = {
  taxMode?: unknown;
  taxRate?: unknown;
  taxableSubtotal?: unknown;
  taxTotal?: unknown;
  grandTotal?: unknown;
};

export type FinanceFiscalSnapshot = {
  taxMode: CommercialTaxMode;
  taxRate: number;
  baseBeforeTax: number;
  taxTransferred: number;
  totalCharged: number;
};

export type FinanceFiscalContribution = FinanceFiscalSnapshot & {
  groupKey: string | null;
};

function toMoneyCents(value: unknown): number | null {
  if (value == null || value === "") return null;

  const normalized = typeof value === "number"
    ? (Number.isFinite(value) ? value.toFixed(6).replace(/\.?0+$/, "") : "")
    : String(value).trim();
  const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  const sign = match[1] === "-" ? -BigInt(1) : BigInt(1);
  const fraction = (match[3] ?? "").padEnd(3, "0");
  let cents = (BigInt(match[2]) * BigInt(100)) + BigInt(fraction.slice(0, 2));
  if (Number(fraction[2] ?? "0") >= 5) cents += BigInt(1);
  cents *= sign;

  const numericCents = Number(cents);
  return Number.isSafeInteger(numericCents) ? numericCents : null;
}

function fromMoneyCents(value: number | bigint): number {
  return Number((Number(value) / 100).toFixed(2));
}

function toTaxRate(value: unknown): number | null {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(4)) : null;
}

function isCommercialTaxMode(value: unknown): value is CommercialTaxMode {
  return value === "tax_included" || value === "tax_added" || value === "tax_exempt";
}

export function buildCommercialSaleFiscalSnapshot(
  input: CommercialSaleFiscalSnapshotInput,
  direction: "sale" | "cancellation",
): FinanceFiscalSnapshot | null {
  if (!isCommercialTaxMode(input.taxMode)) return null;

  const taxRate = toTaxRate(input.taxRate);
  const baseCents = toMoneyCents(input.taxableSubtotal);
  const taxCents = toMoneyCents(input.taxTotal);
  const totalCents = toMoneyCents(input.grandTotal);
  if (
    taxRate == null
    || baseCents == null
    || taxCents == null
    || totalCents == null
    || baseCents < 0
    || taxCents < 0
    || totalCents <= 0
  ) {
    return null;
  }

  if (Math.abs((baseCents + taxCents) - totalCents) > 1) return null;
  if (input.taxMode === "tax_exempt" && taxCents !== 0) return null;

  const sign = direction === "cancellation" ? -1 : 1;
  return {
    taxMode: input.taxMode,
    taxRate,
    baseBeforeTax: fromMoneyCents(baseCents * sign),
    taxTransferred: fromMoneyCents(taxCents * sign),
    totalCharged: fromMoneyCents(totalCents * sign),
  };
}

function multiplyDivideRounded(value: number, numerator: number, denominator: number): number {
  const scaled = BigInt(value) * BigInt(numerator);
  return Number((scaled + (BigInt(denominator) / BigInt(2))) / BigInt(denominator));
}

export function allocateCommercialSaleFiscalSnapshot(
  snapshot: FinanceFiscalSnapshot,
  paymentAmount: unknown,
): FinanceFiscalSnapshot | null {
  const paymentCents = toMoneyCents(paymentAmount);
  const totalCents = toMoneyCents(snapshot.totalCharged);
  const baseCents = toMoneyCents(snapshot.baseBeforeTax);
  if (
    paymentCents == null
    || totalCents == null
    || baseCents == null
    || paymentCents <= 0
    || totalCents <= 0
    || baseCents < 0
  ) {
    return null;
  }

  if (paymentCents === totalCents) return snapshot;
  if (paymentCents > totalCents) return null;

  const allocatedBaseCents = multiplyDivideRounded(baseCents, paymentCents, totalCents);
  return {
    ...snapshot,
    baseBeforeTax: fromMoneyCents(allocatedBaseCents),
    taxTransferred: fromMoneyCents(paymentCents - allocatedBaseCents),
    totalCharged: fromMoneyCents(paymentCents),
  };
}

export function sumUniqueFinanceFiscalContributions(contributions: FinanceFiscalContribution[]) {
  const seenGroupKeys = new Set<string>();
  let baseCents = BigInt(0);
  let taxCents = BigInt(0);
  let totalCents = BigInt(0);
  let countedContributions = 0;

  for (const contribution of contributions) {
    if (contribution.groupKey) {
      if (seenGroupKeys.has(contribution.groupKey)) continue;
      seenGroupKeys.add(contribution.groupKey);
    }

    const contributionBaseCents = toMoneyCents(contribution.baseBeforeTax);
    const contributionTaxCents = toMoneyCents(contribution.taxTransferred);
    const contributionTotalCents = toMoneyCents(contribution.totalCharged);
    if (contributionBaseCents == null || contributionTaxCents == null || contributionTotalCents == null) {
      continue;
    }

    baseCents += BigInt(contributionBaseCents);
    taxCents += BigInt(contributionTaxCents);
    totalCents += BigInt(contributionTotalCents);
    countedContributions += 1;
  }

  return {
    baseBeforeTax: fromMoneyCents(baseCents),
    taxTransferred: fromMoneyCents(taxCents),
    totalCharged: fromMoneyCents(totalCents),
    countedContributions,
  };
}
