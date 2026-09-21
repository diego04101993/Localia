export type HistoricalSaleItemSnapshot = {
  id: string;
  nameSnapshot: string;
  categorySnapshot: string | null;
  quantity: number;
  lineTotalAmount: number;
};

export type HistoricalSaleSnapshot = {
  id: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  sellerNameSnapshot: string | null;
  taxMode: string | null;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  items: HistoricalSaleItemSnapshot[];
};

export type HistoricalCommissionAccrualSnapshot = {
  id: string;
  saleId: string | null;
  saleItemId: string | null;
  accrualType: string;
  status: string;
  rateSnapshot: number | null;
  fixedAmountSnapshot: number | null;
  commissionAmount: number;
  paidAmount: number;
  ruleNameSnapshot: string | null;
  calculationSnapshot: unknown;
  reversedAt: string | null;
};

function moneyToCents(value: number): number {
  return Math.round(Number(value || 0) * 100);
}

function centsToMoney(value: number): number {
  return Math.round(value) / 100;
}

function isLiveSaleCommission(accrual: HistoricalCommissionAccrualSnapshot): boolean {
  return accrual.accrualType === "sale"
    && accrual.status !== "reversed"
    && accrual.reversedAt == null;
}

export function getHistoricalSaleNetBeforeTax(sale: HistoricalSaleSnapshot): number | null {
  const validMode = sale.taxMode === "tax_exempt"
    || sale.taxMode === "tax_included"
    || sale.taxMode === "tax_added";
  if (
    !validMode
    || sale.taxableSubtotal == null
    || sale.taxTotal == null
    || sale.grandTotal == null
    || !Number.isFinite(sale.taxableSubtotal)
    || !Number.isFinite(sale.taxTotal)
    || !Number.isFinite(sale.grandTotal)
    || sale.taxableSubtotal < 0
    || sale.taxTotal < 0
    || sale.grandTotal < 0
    || Math.abs((sale.taxableSubtotal + sale.taxTotal) - sale.grandTotal) > 0.01
    || (sale.taxMode === "tax_exempt" && sale.taxTotal !== 0)
  ) {
    return null;
  }
  return centsToMoney(moneyToCents(sale.taxableSubtotal));
}

export function getCommissionValueSnapshot(accrual: HistoricalCommissionAccrualSnapshot): {
  kind: "percentage" | "fixed_per_unit" | "fixed_per_sale" | "fixed" | "unknown";
  value: number | null;
} {
  const calculation = accrual.calculationSnapshot && typeof accrual.calculationSnapshot === "object"
    ? accrual.calculationSnapshot as { ruleType?: unknown }
    : null;
  const ruleType = typeof calculation?.ruleType === "string" ? calculation.ruleType : null;

  if (accrual.rateSnapshot != null) return { kind: "percentage", value: accrual.rateSnapshot };
  if (accrual.fixedAmountSnapshot == null) return { kind: "unknown", value: null };
  if (ruleType === "fixed_product") return { kind: "fixed_per_unit", value: accrual.fixedAmountSnapshot };
  if (ruleType === "fixed_per_sale") return { kind: "fixed_per_sale", value: accrual.fixedAmountSnapshot };
  return { kind: "fixed", value: accrual.fixedAmountSnapshot };
}

export function buildSalespersonSaleCommissionDetail(
  sale: HistoricalSaleSnapshot,
  accruals: readonly HistoricalCommissionAccrualSnapshot[],
) {
  const saleAccruals = accruals.filter(
    (accrual) => accrual.saleId === sale.id && isLiveSaleCommission(accrual),
  );
  const itemCommissions = new Map<string, HistoricalCommissionAccrualSnapshot[]>();
  const generalCommissions: HistoricalCommissionAccrualSnapshot[] = [];

  for (const accrual of saleAccruals) {
    if (!accrual.saleItemId) {
      generalCommissions.push(accrual);
      continue;
    }
    const current = itemCommissions.get(accrual.saleItemId) ?? [];
    current.push(accrual);
    itemCommissions.set(accrual.saleItemId, current);
  }

  let generatedCents = 0;
  let paidCents = 0;
  for (const accrual of saleAccruals) {
    const commissionCents = Math.max(0, moneyToCents(accrual.commissionAmount));
    generatedCents += commissionCents;
    paidCents += Math.min(commissionCents, Math.max(0, moneyToCents(accrual.paidAmount)));
  }

  return {
    projectId: sale.projectId,
    projectCode: sale.projectCode,
    projectName: sale.projectName,
    sellerNameSnapshot: sale.sellerNameSnapshot,
    netBeforeTax: getHistoricalSaleNetBeforeTax(sale),
    items: sale.items.map((item) => ({
      ...item,
      commissions: itemCommissions.get(item.id) ?? [],
    })),
    generalCommissions,
    generatedCommission: centsToMoney(generatedCents),
    paidCommission: centsToMoney(paidCents),
    pendingCommission: centsToMoney(Math.max(0, generatedCents - paidCents)),
  };
}
