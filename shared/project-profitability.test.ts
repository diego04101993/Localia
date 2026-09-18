import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildProjectProfitabilitySnapshots,
  type ProjectProfitabilityContribution,
} from "../server/project-profitability";
import { createBranchFinanceEntrySchema, updateBranchFinanceEntrySchema } from "./schema";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storageSource = readFileSync(path.join(repositoryRoot, "server", "storage.ts"), "utf8");
const routesSource = readFileSync(path.join(repositoryRoot, "server", "routes.ts"), "utf8");
const projectUiSource = readFileSync(path.join(repositoryRoot, "client", "src", "components", "proyectos-tab.tsx"), "utf8");

test("fiscal detail requires all snapshot fields before showing documentary base and IVA", () => {
  const predicate = projectUiSource.slice(projectUiSource.indexOf("function hasFiscalBreakdown"), projectUiSource.indexOf("export default function ProyectosTab"));
  for (const field of ["taxMode", "taxableSubtotal", "taxTotal", "grandTotal"]) {
    assert.match(predicate, new RegExp(`row\\.${field} != null`));
  }
  assert.doesNotMatch(predicate, /\|\|/);
});

function getSnapshot(contributions: ProjectProfitabilityContribution[] = [], projectId = "project-a") {
  return buildProjectProfitabilitySnapshots([projectId], contributions).get(projectId)!;
}

function contribution(values: Omit<ProjectProfitabilityContribution, "projectId">, projectId = "project-a") {
  return { projectId, ...values };
}

test("1. empty project returns zero metrics", () => {
  const result = getSnapshot();
  assert.equal(result.salesFinalTotal, 0);
  assert.equal(result.cashFlowNet, 0);
  assert.equal(result.profit, 0);
});

test("2. sale contributes its stored economic total", () => {
  const result = getSnapshot([contribution({ salesBeforeTax: 1_000, salesFinalTotal: 1_160 })]);
  assert.equal(result.salesBeforeTax, 1_000);
  assert.equal(result.salesFinalTotal, 1_160);
});

test("3. collected amount uses the persisted sale aggregate", () => {
  assert.equal(getSnapshot([contribution({ salesPaidTotal: 400 })]).salesPaidTotal, 400);
});

test("4. accounts receivable is the nonnegative sale balance", () => {
  assert.equal(getSnapshot([contribution({ salesFinalTotal: 1_000, salesPaidTotal: 400 })]).accountsReceivable, 600);
});

test("5. COGS uses the frozen sale-item contribution", () => {
  const result = getSnapshot([contribution({ salesBeforeTax: 1_000, cogsTotal: 310 })]);
  assert.equal(result.cogsTotal, 310);
  assert.equal(result.profit, 690);
});

test("6. current catalog cost is not part of the COGS query", () => {
  const summarySection = storageSource.slice(
    storageSource.indexOf("private async getBranchCommercialProjectSummaryMap"),
    storageSource.indexOf("private async getBranchCommercialProjectRowById"),
  );
  assert.match(summarySection, /branchSaleItems\.costAmountSnapshot/);
  assert.doesNotMatch(summarySection, /branchCommercialProducts\.cost/);
});

test("7. committed purchase total is reported independently", () => {
  assert.equal(getSnapshot([contribution({ purchasesCommittedTotal: 500 })]).purchasesCommittedTotal, 500);
  assert.match(storageSource, /const purchaseHasReliableFiscalSnapshot = sql<boolean>/);
});

test("8. supplier payments use the persisted purchase paid amount", () => {
  assert.equal(getSnapshot([contribution({ purchasePaidTotal: 200 })]).purchasePaidTotal, 200);
});

test("9. accounts payable is the nonnegative purchase balance", () => {
  assert.equal(getSnapshot([contribution({ purchasesCommittedTotal: 500, purchasePaidTotal: 200 })]).accountsPayable, 300);
});

test("10. legacy purchase paid_amount remains the aggregate authority", () => {
  assert.match(storageSource, /purchasePaidTotal:[\s\S]*branchPurchases\.paidAmount/);
});

test("11. direct manual expense reduces project profit", () => {
  const result = getSnapshot([contribution({ salesBeforeTax: 1_000, directManualExpenses: 125 })]);
  assert.equal(result.profit, 875);
});

test("12. direct manual income contributes only to cash in", () => {
  const result = getSnapshot([contribution({ directManualIncome: 80, cashIn: 80 })]);
  assert.equal(result.cashIn, 80);
  assert.equal(result.profit, 0);
});

test("13. manual finance aggregation excludes soft-deleted rows", () => {
  const summarySection = storageSource.slice(
    storageSource.indexOf("directManualIncome: sql<number>"),
    storageSource.indexOf("accruedCommissions: sql<number>"),
  );
  assert.match(summarySection, /isNull\(branchFinanceEntries\.deletedAt\)/);
});

test("14. automatic finance inserts cannot persist direct project attribution", () => {
  assert.match(
    storageSource,
    /projectId: normalizeOptionalTextValue\(data\.source\) \? null : \(data\.projectId \?\? null\)/,
  );
});

test("15. commercial sale cash resolves through payment and sale", () => {
  assert.match(storageSource, /eq\(branchSalePayments\.id, branchFinanceEntries\.sourceId\)/);
  assert.match(storageSource, /eq\(branchSales\.id, branchSalePayments\.saleId\)/);
});

test("16. purchase payment cash resolves through payment and purchase", () => {
  assert.match(storageSource, /eq\(branchPurchasePayments\.id, branchFinanceEntries\.sourceId\)/);
  assert.match(storageSource, /eq\(branchPurchases\.id, branchPurchasePayments\.purchaseId\)/);
});

test("17. sale economics and sale cash do not double-count revenue", () => {
  const result = getSnapshot([
    contribution({ salesBeforeTax: 1_000, salesFinalTotal: 1_160 }),
    contribution({ cashIn: 1_160 }),
  ]);
  assert.equal(result.salesFinalTotal, 1_160);
  assert.equal(result.cashIn, 1_160);
});

test("18. purchase economics and payment cash do not double-count purchases", () => {
  const result = getSnapshot([
    contribution({ purchasesCommittedTotal: 500, purchasePaidTotal: 200 }),
    contribution({ cashOut: 200 }),
  ]);
  assert.equal(result.purchasesCommittedTotal, 500);
  assert.equal(result.cashOut, 200);
});

test("19. cancelled sales are excluded from economic SQL aggregates", () => {
  assert.match(storageSource, /branchSales\.status} = 'completed'[\s\S]*branchSales\.cancelledAt} IS NULL/);
  assert.match(storageSource, /const saleHasReliableFiscalSnapshot = sql<boolean>/);
  assert.match(storageSource, /ABS\(\(\$\{branchSales\.taxableSubtotal}/);
});

test("20. sale reversal affects cash flow but not operating expense", () => {
  const result = getSnapshot([contribution({ cashIn: 116, cashOut: 116 })]);
  assert.equal(result.cashFlowNet, 0);
  assert.equal(result.directManualExpenses, 0);
});

test("21. live attributable commission reduces profit", () => {
  const result = getSnapshot([contribution({ salesBeforeTax: 1_000, accruedCommissions: 100 })]);
  assert.equal(result.profit, 900);
});

test("22. paid commission cash uses allocation amount", () => {
  assert.match(storageSource, /branchCommissionPaymentAllocations\.amountAllocated/);
});

test("23. a multi-project commission payment is split without duplication", () => {
  const results = buildProjectProfitabilitySnapshots(
    ["project-a", "project-b"],
    [contribution({ cashOut: 40 }, "project-a"), contribution({ cashOut: 60 }, "project-b")],
  );
  assert.equal(results.get("project-a")!.cashOut, 40);
  assert.equal(results.get("project-b")!.cashOut, 60);
});

test("24. monthly bonus accruals are excluded from project commission", () => {
  assert.match(storageSource, /eq\(branchCommissionAccruals\.accrualType, "sale"\)/);
});

test("25. project profit follows the approved formula", () => {
  const result = getSnapshot([contribution({
    salesBeforeTax: 1_000,
    cogsTotal: 300,
    directManualExpenses: 100,
    accruedCommissions: 50,
  })]);
  assert.equal(result.profit, 550);
});

test("26. margin uses profit divided by sales before VAT", () => {
  const result = getSnapshot([contribution({ salesBeforeTax: 1_000, cogsTotal: 250 })]);
  assert.equal(result.marginPercent, 75);
});

test("27. zero sales never returns NaN or Infinity", () => {
  const result = getSnapshot([contribution({ directManualExpenses: 10 })]);
  assert.equal(result.marginPercent, null);
  assert.equal(Number.isFinite(result.cashFlowNet), true);
});

test("28. manual finance project validation is tenant scoped", () => {
  const validationSection = storageSource.slice(
    storageSource.indexOf("private async validateManualFinanceProjectTx"),
    storageSource.indexOf("private async validateManualFinanceClientTx"),
  );
  assert.match(validationSection, /eq\(branchCommercialProjects\.branchId, branchId\)/);
});

test("29. a project from another branch is rejected", () => {
  assert.match(storageSource, /throw new Error\("BRANCH_FINANCE_PROJECT_INVALID"\)/);
  assert.match(routesSource, /BRANCH_FINANCE_PROJECT_INVALID/);
});

test("30. protected automatic entries cannot edit projectId", () => {
  assert.match(routesSource, /classifyFinanceSource\(existingEntry\.source\) !== "manual"/);
  assert.match(storageSource, /!this\.isManualFinanceSource\(existing\.source\)/);
});

test("31. manual API rejects source, sourceId and metadata forgery", () => {
  const basePayload = {
    type: "income",
    concept: "Manual",
    amount: 10,
    entryDate: "2026-09-11",
  };
  assert.equal(createBranchFinanceEntrySchema.safeParse({ ...basePayload, source: "commercial_sale" }).success, false);
  assert.equal(createBranchFinanceEntrySchema.safeParse({ ...basePayload, sourceId: "sale-1" }).success, false);
  assert.equal(createBranchFinanceEntrySchema.safeParse({ ...basePayload, metadata: { saleId: "sale-1" } }).success, false);
});

test("32. manual create and audit share one transaction", () => {
  const section = storageSource.slice(
    storageSource.indexOf("async createManualBranchFinanceEntry"),
    storageSource.indexOf("async findBranchFinanceEntryBySource", storageSource.indexOf("async createManualBranchFinanceEntry")),
  );
  assert.match(section, /db\.transaction/);
  assert.match(section, /createAuditLogTx\(tx/);
});

test("33. manual update and audit share one transaction", () => {
  const section = storageSource.slice(
    storageSource.indexOf("async updateManualBranchFinanceEntry"),
    storageSource.indexOf("async softDeleteManualBranchFinanceEntry"),
  );
  assert.match(section, /db\.transaction/);
  assert.match(section, /\.for\("update"\)/);
  assert.match(section, /createAuditLogTx\(tx/);
});

test("34. project list uses fixed-count bulk aggregates instead of per-project queries", () => {
  const section = storageSource.slice(
    storageSource.indexOf("private async getBranchCommercialProjectSummaryMap"),
    storageSource.indexOf("private async getBranchCommercialProjectRowById"),
  );
  assert.match(section, /Promise\.all/);
  assert.doesNotMatch(section, /for \(const projectId of projectIds\)[\s\S]*await db/);
});

test("35. multiple sales aggregate without rounding drift", () => {
  const result = getSnapshot([
    contribution({ salesBeforeTax: 10.1, salesFinalTotal: 11.72 }),
    contribution({ salesBeforeTax: 20.2, salesFinalTotal: 23.43 }),
  ]);
  assert.equal(result.salesBeforeTax, 30.3);
  assert.equal(result.salesFinalTotal, 35.15);
});

test("36. multiple purchases aggregate into one project balance", () => {
  const result = getSnapshot([
    contribution({ purchasesCommittedTotal: 200, purchasePaidTotal: 50 }),
    contribution({ purchasesCommittedTotal: 300, purchasePaidTotal: 100 }),
  ]);
  assert.equal(result.purchasesCommittedTotal, 500);
  assert.equal(result.accountsPayable, 350);
});

test("37. multiple direct expenses aggregate once", () => {
  const result = getSnapshot([
    contribution({ salesBeforeTax: 500 }),
    contribution({ directManualExpenses: 40 }),
    contribution({ directManualExpenses: 60 }),
  ]);
  assert.equal(result.directManualExpenses, 100);
  assert.equal(result.profit, 400);
});

test("38. project detail also excludes soft-deleted manual finance", () => {
  const detailSection = storageSource.slice(
    storageSource.indexOf("const [salesRows, purchaseRows, manualFinanceRows]"),
    storageSource.indexOf("const sales = salesRows.map"),
  );
  assert.match(detailSection, /isNull\(branchFinanceEntries\.deletedAt\)/);
  assert.equal(updateBranchFinanceEntrySchema.safeParse({ projectId: null }).success, true);
});

test("39. obligation economics, debt and cash stay separate through partial and final payment", () => {
  for (const [paid, debt, cashOut] of [[0, 1160, 0], [500, 660, 500], [1160, 0, 1160]]) {
    const result = getSnapshot([
      contribution({ obligationBeforeTax: 1000, obligationTotal: 1160, obligationTaxTotal: 160 }),
      contribution({ obligationPaidTotal: paid }),
      contribution({ cashOut }),
    ]);
    assert.equal(result.obligationBeforeTax, 1000);
    assert.equal(result.profit, -1000);
    assert.equal(result.accountsPayableOtherExpenses, debt);
    assert.equal(result.cashOut, cashOut);
  }
});

test("40. purchase debt and other expense debt remain distinct", () => {
  const result = getSnapshot([
    contribution({ purchasesCommittedTotal: 500, purchasePaidTotal: 200 }),
    contribution({ obligationTotal: 1160, obligationPaidTotal: 500 }),
  ]);
  assert.equal(result.accountsPayablePurchases, 300);
  assert.equal(result.accountsPayableOtherExpenses, 660);
  assert.equal(result.accountsPayable, 960);
});

test("41. document and payment aggregates do not multiply one another", () => {
  const section = storageSource.slice(
    storageSource.indexOf("private async getBranchCommercialProjectSummaryMap"),
    storageSource.indexOf("private async getBranchCommercialProjectRowById"),
  );
  assert.match(section, /obligationBeforeTax: sql<number>`COALESCE\(SUM\(\$\{branchExpenseObligations\.taxableSubtotal\}\)/);
  assert.match(section, /obligationPaidTotal: sql<number>`COALESCE\(SUM\(\$\{branchExpenseObligationPayments\.amount\}\)/);
  assert.match(section, /eq\(branchFinanceEntries\.source, "expense_obligation_payment"\)/);
});
