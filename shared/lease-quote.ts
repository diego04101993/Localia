import { z } from "zod";

import {
  computeMembershipPlanChargeSnapshot,
  computeTaxBreakdownFromPretaxSubtotal,
  membershipPlanTaxModeValues,
  roundMoneyDiv,
  type MembershipPlanTaxMode,
} from "./membership-plan-tax";
import {
  addCalendarMonthsClamped,
  calculateLeaseContractEndDate,
  formatLeaseContractIsoDate,
  parseLeaseContractIsoDate,
} from "./lease-contract";

export const leaseQuoteTermPresets = [12, 24, 36] as const;
export const leaseQuoteDownPaymentTypeValues = ["amount", "percentage"] as const;
export type LeaseQuoteDownPaymentType = (typeof leaseQuoteDownPaymentTypeValues)[number];

export const leaseQuoteRequestSchema = z.object({
  clientUserId: z.string().trim().min(1, "El cliente es obligatorio"),
  leasedItemDescription: z.string().trim().min(1, "El bien o equipo es obligatorio").max(200, "Máximo 200 caracteres"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de inicio no es válida"),
  termMonths: z.number().int().min(1, "El plazo debe ser mayor a 0").max(600, "El plazo no puede exceder 600 meses"),
  capturedAssetValueCents: z.number().int().min(0, "El valor del bien no puede ser negativo"),
  surchargeRate: z.number().min(0, "El recargo no puede ser negativo").max(1000, "El recargo es demasiado alto"),
  downPaymentEnabled: z.boolean().optional().default(false),
  downPaymentType: z.enum(leaseQuoteDownPaymentTypeValues).nullable().optional(),
  downPaymentAmountCents: z.number().int().min(0, "El monto del enganche no puede ser negativo").nullable().optional(),
  downPaymentRate: z.number().min(0, "El porcentaje del enganche no puede ser negativo").max(100, "El porcentaje del enganche no puede exceder 100").nullable().optional(),
  taxMode: z.enum(membershipPlanTaxModeValues),
  taxRate: z.number().min(0, "La tasa IVA no puede ser negativa").max(100, "La tasa IVA no puede exceder 100"),
  notes: z.string().trim().max(500, "Las notas no pueden exceder 500 caracteres").nullable().optional().or(z.literal("")),
});

export type LeaseQuoteRequest = z.infer<typeof leaseQuoteRequestSchema>;

export type LeaseQuoteInstallmentRow = {
  installmentNumber: number;
  dueDate: string;
  subtotalBeforeTaxCents: number;
  taxableSubtotalCents: number;
  taxTotalCents: number;
  finalTotalCents: number;
};

export type LeaseQuotePreview = {
  startDate: string;
  contractEndDate: string;
  termMonths: number;
  taxMode: MembershipPlanTaxMode;
  taxRate: number;
  capturedAssetValueCents: number;
  assetSubtotalBeforeTaxCents: number;
  assetTaxableSubtotalCents: number;
  assetTaxCents: number;
  assetFinalTotalCents: number;
  downPaymentEnabled: boolean;
  downPaymentType: LeaseQuoteDownPaymentType | null;
  downPaymentInputCents: number | null;
  downPaymentRate: number | null;
  downPaymentSubtotalBeforeTaxCents: number;
  downPaymentTaxableSubtotalCents: number;
  downPaymentTaxCents: number;
  downPaymentFinalTotalCents: number;
  financedPrincipalBeforeTaxCents: number;
  surchargeRate: number;
  surchargeTotalCents: number;
  financedSubtotalBeforeTaxCents: number;
  financedTaxableSubtotalCents: number;
  contractTaxTotalCents: number;
  financedFinalTotalCents: number;
  contractFinalTotalCents: number;
  approximateInstallmentSubtotalBeforeTaxCents: number;
  approximateInstallmentTaxableSubtotalCents: number;
  approximateInstallmentTaxCents: number;
  approximateInstallmentFinalTotalCents: number;
  finalInstallmentSubtotalBeforeTaxCents: number;
  finalInstallmentTaxableSubtotalCents: number;
  finalInstallmentTaxCents: number;
  finalInstallmentFinalTotalCents: number;
  hasAdjustedFinalInstallment: boolean;
  installmentRows: LeaseQuoteInstallmentRow[];
};

const SURCHARGE_RATE_SCALE = 10_000;
const SURCHARGE_RATE_DENOMINATOR = 100 * SURCHARGE_RATE_SCALE;

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

function normalizeRate(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}`);
  }
  return Math.round(value * SURCHARGE_RATE_SCALE) / SURCHARGE_RATE_SCALE;
}

function resolveDownPaymentBreakdown(params: {
  assetSubtotalBeforeTaxCents: number;
  request: LeaseQuoteRequest;
}) {
  if (!params.request.downPaymentEnabled) {
    return {
      enabled: false,
      type: null,
      inputCents: null,
      rate: null,
      subtotalBeforeTaxCents: 0,
      taxableSubtotalCents: 0,
      taxTotalCents: 0,
      finalTotalCents: 0,
    };
  }

  const type = params.request.downPaymentType;
  if (!type) {
    throw new Error("DOWN_PAYMENT_TYPE_REQUIRED");
  }

  if (type === "percentage") {
    const normalizedRate = normalizeRate(params.request.downPaymentRate ?? Number.NaN, "down_payment_rate");
    const scaledRate = Math.round(normalizedRate * SURCHARGE_RATE_SCALE);
    const subtotalBeforeTaxCents = roundMoneyDiv(
      params.assetSubtotalBeforeTaxCents * scaledRate,
      SURCHARGE_RATE_DENOMINATOR,
    );
    const breakdown = computeTaxBreakdownFromPretaxSubtotal({
      subtotalBeforeTaxCents,
      taxMode: params.request.taxMode,
      taxRate: params.request.taxRate,
    });

    return {
      enabled: true,
      type,
      inputCents: null,
      rate: normalizedRate,
      subtotalBeforeTaxCents,
      taxableSubtotalCents: breakdown.taxableSubtotalCents,
      taxTotalCents: breakdown.taxTotalCents,
      finalTotalCents: breakdown.finalTotalCents,
    };
  }

  const inputCents = normalizeNonNegativeInteger(params.request.downPaymentAmountCents ?? Number.NaN, "down_payment_amount_cents");
  const snapshot = computeMembershipPlanChargeSnapshot({
    priceCents: inputCents,
    taxMode: params.request.taxMode,
    taxRate: params.request.taxRate,
  });

  return {
    enabled: true,
    type,
    inputCents,
    rate: null,
    subtotalBeforeTaxCents: snapshot.subtotalBeforeTaxCents ?? snapshot.finalTotalCents,
    taxableSubtotalCents: snapshot.taxableSubtotalCents ?? snapshot.subtotalBeforeTaxCents ?? snapshot.finalTotalCents,
    taxTotalCents: snapshot.taxTotalCents ?? 0,
    finalTotalCents: snapshot.finalTotalCents,
  };
}

function splitTotalIntoInstallments(totalCents: number, termMonths: number) {
  const normalizedTotalCents = normalizeNonNegativeInteger(totalCents, "total_cents");
  const normalizedTermMonths = normalizePositiveInteger(termMonths, "term_months");
  const installments = new Array<number>(normalizedTermMonths).fill(0);
  const commonAmount = Math.floor(normalizedTotalCents / normalizedTermMonths);
  const finalAmount = normalizedTotalCents - commonAmount * (normalizedTermMonths - 1);

  for (let index = 0; index < normalizedTermMonths - 1; index += 1) {
    installments[index] = commonAmount;
  }
  installments[normalizedTermMonths - 1] = finalAmount;

  return installments;
}

export function calculateLeaseQuote(input: LeaseQuoteRequest): LeaseQuotePreview {
  const validated = leaseQuoteRequestSchema.parse(input);
  const parsedStartDate = parseLeaseContractIsoDate(validated.startDate);
  if (!parsedStartDate) {
    throw new Error("INVALID_START_DATE");
  }

  const capturedAssetValueCents = normalizeNonNegativeInteger(validated.capturedAssetValueCents, "captured_asset_value_cents");
  const termMonths = normalizePositiveInteger(validated.termMonths, "term_months");
  const surchargeRate = normalizeRate(validated.surchargeRate, "surcharge_rate");

  const assetSnapshot = computeMembershipPlanChargeSnapshot({
    priceCents: capturedAssetValueCents,
    taxMode: validated.taxMode,
    taxRate: validated.taxRate,
  });

  const assetSubtotalBeforeTaxCents = assetSnapshot.subtotalBeforeTaxCents ?? assetSnapshot.finalTotalCents;
  const assetTaxableSubtotalCents = assetSnapshot.taxableSubtotalCents ?? assetSubtotalBeforeTaxCents;
  const assetTaxCents = assetSnapshot.taxTotalCents ?? 0;
  const downPaymentBreakdown = resolveDownPaymentBreakdown({
    assetSubtotalBeforeTaxCents,
    request: validated,
  });
  const financedPrincipalBeforeTaxCents = assetSubtotalBeforeTaxCents - downPaymentBreakdown.subtotalBeforeTaxCents;
  if (financedPrincipalBeforeTaxCents <= 0) {
    throw new Error("DOWN_PAYMENT_MUST_LEAVE_FINANCED_BALANCE");
  }
  const surchargeScaledRate = Math.round(surchargeRate * SURCHARGE_RATE_SCALE);
  const surchargeTotalCents = roundMoneyDiv(
    financedPrincipalBeforeTaxCents * surchargeScaledRate,
    SURCHARGE_RATE_DENOMINATOR,
  );
  const financedSubtotalBeforeTaxCents = financedPrincipalBeforeTaxCents + surchargeTotalCents;
  const contractTaxBreakdown = computeTaxBreakdownFromPretaxSubtotal({
    subtotalBeforeTaxCents: financedSubtotalBeforeTaxCents,
    taxMode: validated.taxMode,
    taxRate: validated.taxRate,
  });

  const subtotalInstallments = splitTotalIntoInstallments(contractTaxBreakdown.subtotalBeforeTaxCents, termMonths);
  const taxableSubtotalInstallments = splitTotalIntoInstallments(contractTaxBreakdown.taxableSubtotalCents, termMonths);
  const taxInstallments = splitTotalIntoInstallments(contractTaxBreakdown.taxTotalCents, termMonths);

  const installmentRows: LeaseQuoteInstallmentRow[] = subtotalInstallments.map((subtotalBeforeTaxCents, index) => {
    const dueDate = formatLeaseContractIsoDate(addCalendarMonthsClamped(parsedStartDate, index));
    const taxableSubtotalCents = taxableSubtotalInstallments[index] ?? subtotalBeforeTaxCents;
    const taxTotalCents = taxInstallments[index] ?? 0;
    return {
      installmentNumber: index + 1,
      dueDate,
      subtotalBeforeTaxCents,
      taxableSubtotalCents,
      taxTotalCents,
      finalTotalCents: subtotalBeforeTaxCents + taxTotalCents,
    };
  });

  const contractEndDate = calculateLeaseContractEndDate(validated.startDate, termMonths);
  if (!contractEndDate) {
    throw new Error("INVALID_START_DATE");
  }

  const firstInstallment = installmentRows[0];
  const finalInstallment = installmentRows[installmentRows.length - 1];
  const hasAdjustedFinalInstallment =
    firstInstallment.subtotalBeforeTaxCents !== finalInstallment.subtotalBeforeTaxCents
    || firstInstallment.taxTotalCents !== finalInstallment.taxTotalCents
    || firstInstallment.finalTotalCents !== finalInstallment.finalTotalCents;

  return {
    startDate: validated.startDate,
    contractEndDate,
    termMonths,
    taxMode: validated.taxMode,
    taxRate: contractTaxBreakdown.taxRate,
    capturedAssetValueCents,
    assetSubtotalBeforeTaxCents,
    assetTaxableSubtotalCents,
    assetTaxCents,
    assetFinalTotalCents: assetSnapshot.finalTotalCents,
    downPaymentEnabled: downPaymentBreakdown.enabled,
    downPaymentType: downPaymentBreakdown.type,
    downPaymentInputCents: downPaymentBreakdown.inputCents,
    downPaymentRate: downPaymentBreakdown.rate,
    downPaymentSubtotalBeforeTaxCents: downPaymentBreakdown.subtotalBeforeTaxCents,
    downPaymentTaxableSubtotalCents: downPaymentBreakdown.taxableSubtotalCents,
    downPaymentTaxCents: downPaymentBreakdown.taxTotalCents,
    downPaymentFinalTotalCents: downPaymentBreakdown.finalTotalCents,
    financedPrincipalBeforeTaxCents,
    surchargeRate,
    surchargeTotalCents,
    financedSubtotalBeforeTaxCents,
    financedTaxableSubtotalCents: contractTaxBreakdown.taxableSubtotalCents,
    contractTaxTotalCents: contractTaxBreakdown.taxTotalCents,
    financedFinalTotalCents: contractTaxBreakdown.finalTotalCents,
    contractFinalTotalCents: contractTaxBreakdown.finalTotalCents + downPaymentBreakdown.finalTotalCents,
    approximateInstallmentSubtotalBeforeTaxCents: firstInstallment.subtotalBeforeTaxCents,
    approximateInstallmentTaxableSubtotalCents: firstInstallment.taxableSubtotalCents,
    approximateInstallmentTaxCents: firstInstallment.taxTotalCents,
    approximateInstallmentFinalTotalCents: firstInstallment.finalTotalCents,
    finalInstallmentSubtotalBeforeTaxCents: finalInstallment.subtotalBeforeTaxCents,
    finalInstallmentTaxableSubtotalCents: finalInstallment.taxableSubtotalCents,
    finalInstallmentTaxCents: finalInstallment.taxTotalCents,
    finalInstallmentFinalTotalCents: finalInstallment.finalTotalCents,
    hasAdjustedFinalInstallment,
    installmentRows,
  };
}
