const MONEY_FIELDS = [
  "salesBeforeTax",
  "salesHistoricalWithoutTaxBreakdown",
  "salesFinalTotal",
  "salesPaidTotal",
  "taxCollected",
  "cogsTotal",
  "purchasesCommittedBeforeTax",
  "purchasesCommittedHistoricalWithoutTaxBreakdown",
  "purchasesCommittedTotal",
  "purchasesReceivedBeforeTax",
  "purchasesReceivedHistoricalWithoutTaxBreakdown",
  "purchasePaidTotal",
  "obligationBeforeTax",
  "obligationTotal",
  "obligationTaxTotal",
  "obligationPaidTotal",
  "directManualIncome",
  "directManualExpenses",
  "shippingExpenses",
  "otherOperatingExpenses",
  "accruedCommissions",
  "paidCommissions",
  "pendingCommissions",
  "cashIn",
  "cashOut",
] as const;

const COUNT_FIELDS = [
  "linkedSalesCount",
  "linkedPurchasesCount",
  "linkedDraftPurchasesCount",
] as const;

type ProjectMoneyField = (typeof MONEY_FIELDS)[number];
type ProjectCountField = (typeof COUNT_FIELDS)[number];

export type ProjectProfitabilityContribution = {
  projectId: string;
} & Partial<Record<ProjectMoneyField | ProjectCountField, number>>;

export interface ProjectProfitabilitySnapshot extends Record<ProjectMoneyField | ProjectCountField, number> {
  accountsReceivable: number;
  accountsPayable: number;
  accountsPayablePurchases: number;
  accountsPayableOtherExpenses: number;
  accountsPayableCommissions: number;
  totalPendingPayable: number;
  cashFlowNet: number;
  profit: number | null;
  profitIsComplete: boolean;
  marginPercent: number | null;
}

function moneyToCents(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Number(value) * 100);
}

function centsToMoney(value: number) {
  return Math.round(value) / 100;
}

function createEmptySnapshot(): ProjectProfitabilitySnapshot {
  return {
    linkedSalesCount: 0,
    linkedPurchasesCount: 0,
    linkedDraftPurchasesCount: 0,
    salesBeforeTax: 0,
    salesHistoricalWithoutTaxBreakdown: 0,
    salesFinalTotal: 0,
    salesPaidTotal: 0,
    taxCollected: 0,
    cogsTotal: 0,
    purchasesCommittedBeforeTax: 0,
    purchasesCommittedHistoricalWithoutTaxBreakdown: 0,
    purchasesCommittedTotal: 0,
    purchasesReceivedBeforeTax: 0,
    purchasesReceivedHistoricalWithoutTaxBreakdown: 0,
    purchasePaidTotal: 0,
    obligationBeforeTax: 0,
    obligationTotal: 0,
    obligationTaxTotal: 0,
    obligationPaidTotal: 0,
    directManualIncome: 0,
    directManualExpenses: 0,
    shippingExpenses: 0,
    otherOperatingExpenses: 0,
    accruedCommissions: 0,
    paidCommissions: 0,
    pendingCommissions: 0,
    cashIn: 0,
    cashOut: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    accountsPayablePurchases: 0,
    accountsPayableOtherExpenses: 0,
    accountsPayableCommissions: 0,
    totalPendingPayable: 0,
    cashFlowNet: 0,
    profit: 0,
    profitIsComplete: true,
    marginPercent: null,
  };
}

export function buildProjectProfitabilitySnapshots(
  projectIds: readonly string[],
  contributions: readonly ProjectProfitabilityContribution[],
) {
  const snapshots = new Map<string, ProjectProfitabilitySnapshot>();
  const centsByProject = new Map<string, Record<ProjectMoneyField, number>>();

  for (const projectId of projectIds) {
    snapshots.set(projectId, createEmptySnapshot());
    centsByProject.set(projectId, Object.fromEntries(MONEY_FIELDS.map((field) => [field, 0])) as Record<ProjectMoneyField, number>);
  }

  for (const contribution of contributions) {
    const snapshot = snapshots.get(contribution.projectId);
    const cents = centsByProject.get(contribution.projectId);
    if (!snapshot || !cents) continue;

    for (const field of COUNT_FIELDS) {
      snapshot[field] += Math.max(0, Math.trunc(Number(contribution[field] ?? 0)));
    }
    for (const field of MONEY_FIELDS) {
      cents[field] += moneyToCents(contribution[field]);
    }
  }

  for (const projectId of projectIds) {
    const snapshot = snapshots.get(projectId)!;
    const cents = centsByProject.get(projectId)!;
    for (const field of MONEY_FIELDS) {
      snapshot[field] = centsToMoney(cents[field]);
    }

    const receivableCents = Math.max(0, cents.salesFinalTotal - cents.salesPaidTotal);
    const purchasePayableCents = Math.max(0, cents.purchasesCommittedTotal - cents.purchasePaidTotal);
    const otherPayableCents = Math.max(0, cents.obligationTotal - cents.obligationPaidTotal);
    const commissionPayableCents = Math.max(0, cents.pendingCommissions);
    const cashFlowCents = cents.cashIn - cents.cashOut;
    const profitIsComplete = cents.salesHistoricalWithoutTaxBreakdown === 0;
    const profitCents = cents.salesBeforeTax
      - cents.cogsTotal
      - cents.directManualExpenses
      - cents.obligationBeforeTax
      - cents.accruedCommissions;

    snapshot.accountsReceivable = centsToMoney(receivableCents);
    snapshot.accountsPayablePurchases = centsToMoney(purchasePayableCents);
    snapshot.accountsPayableOtherExpenses = centsToMoney(otherPayableCents);
    snapshot.accountsPayable = centsToMoney(purchasePayableCents + otherPayableCents);
    snapshot.accountsPayableCommissions = centsToMoney(commissionPayableCents);
    snapshot.totalPendingPayable = centsToMoney(purchasePayableCents + otherPayableCents + commissionPayableCents);
    snapshot.cashFlowNet = centsToMoney(cashFlowCents);
    snapshot.profitIsComplete = profitIsComplete;
    snapshot.profit = profitIsComplete ? centsToMoney(profitCents) : null;
    snapshot.marginPercent = profitIsComplete && cents.salesBeforeTax > 0
      ? Math.round((profitCents / cents.salesBeforeTax) * 10_000) / 100
      : null;
  }

  return snapshots;
}

export function isProjectShippingCategory(value: string | null | undefined): boolean {
  if (!value) return false;
  const tokens = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return tokens.some((token) => ["envio", "envios", "logistica", "flete", "fletes"].includes(token));
}
