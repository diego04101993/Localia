export const protectedFinanceSourceValues = [
  "membership_assign",
  "membership_renew",
  "service_sale",
  "commercial_sale",
  "commercial_sale_cancellation",
  "sales_commission_payment",
  "lease_installment_payment",
  "fixed_expense",
  "staff_class_log",
] as const;

export type ProtectedFinanceSource = typeof protectedFinanceSourceValues[number];
export type FinanceSourceClassification = "manual" | "automatic" | "legacy";

const protectedFinanceSources = new Set<string>(protectedFinanceSourceValues);

export function isProtectedFinanceSource(
  source: string | null | undefined,
): source is ProtectedFinanceSource {
  return typeof source === "string" && protectedFinanceSources.has(source);
}

export function classifyFinanceSource(
  source: string | null | undefined,
): FinanceSourceClassification {
  if (isProtectedFinanceSource(source)) return "automatic";
  if (source == null || source.trim().length === 0) return "manual";
  return "legacy";
}
