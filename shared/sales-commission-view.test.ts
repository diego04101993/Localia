import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSalespersonSaleCommissionDetail,
  getCommissionValueSnapshot,
  getHistoricalSaleNetBeforeTax,
  type HistoricalCommissionAccrualSnapshot,
  type HistoricalSaleSnapshot,
} from "./sales-commission-view";

const liverpoolSale: HistoricalSaleSnapshot = {
  id: "sale-liverpool",
  projectId: "project-liverpool",
  projectCode: "LIV-001",
  projectName: "Liverpool",
  sellerNameSnapshot: "Vendedora Histórica",
  taxMode: "tax_added",
  taxableSubtotal: 500_000,
  taxTotal: 80_000,
  grandTotal: 580_000,
  items: [{
    id: "item-monitor",
    nameSnapshot: "Monitor Samsung 43\"",
    categorySnapshot: "Monitores",
    quantity: 100,
    lineTotalAmount: 500_000,
  }],
};

function accrual(overrides: Partial<HistoricalCommissionAccrualSnapshot> = {}): HistoricalCommissionAccrualSnapshot {
  return {
    id: "commission-specific",
    saleId: liverpoolSale.id,
    saleItemId: "item-monitor",
    accrualType: "sale",
    status: "paid",
    rateSnapshot: 4,
    fixedAmountSnapshot: null,
    commissionAmount: 20_000,
    paidAmount: 20_000,
    ruleNameSnapshot: "Monitor 4%",
    calculationSnapshot: { ruleType: "percentage_product" },
    reversedAt: null,
    ...overrides,
  };
}

test("seller, project and product snapshots remain linked in the sale detail", () => {
  const detail = buildSalespersonSaleCommissionDetail(liverpoolSale, [accrual()]);
  assert.equal(detail.projectId, "project-liverpool");
  assert.equal(detail.projectName, "Liverpool");
  assert.equal(detail.sellerNameSnapshot, "Vendedora Histórica");
  assert.equal(detail.items[0].nameSnapshot, "Monitor Samsung 43\"");
  assert.equal(detail.items[0].quantity, 100);
});

test("specific commission stays attached to its historical sale item", () => {
  const detail = buildSalespersonSaleCommissionDetail(liverpoolSale, [accrual()]);
  assert.equal(detail.items[0].commissions.length, 1);
  assert.equal(detail.generalCommissions.length, 0);
  assert.equal(detail.generatedCommission, 20_000);
  assert.equal(detail.paidCommission, 20_000);
  assert.equal(detail.pendingCommission, 0);
  assert.deepEqual(getCommissionValueSnapshot(detail.items[0].commissions[0]), { kind: "percentage", value: 4 });
});

test("general commission remains at sale level without false product allocation", () => {
  const general = accrual({
    id: "commission-general",
    saleItemId: null,
    rateSnapshot: 2,
    commissionAmount: 10_000,
    paidAmount: 2_500,
    ruleNameSnapshot: "General 2%",
    calculationSnapshot: { ruleType: "percentage_all_sales" },
  });
  const detail = buildSalespersonSaleCommissionDetail(liverpoolSale, [general]);
  assert.equal(detail.items[0].commissions.length, 0);
  assert.equal(detail.generalCommissions.length, 1);
  assert.equal(detail.pendingCommission, 7_500);
});

test("monthly bonus is not attributed to the triggering sale or project", () => {
  const detail = buildSalespersonSaleCommissionDetail(liverpoolSale, [accrual({
    id: "monthly-bonus",
    saleItemId: null,
    accrualType: "monthly_bonus",
    commissionAmount: 5_000,
    paidAmount: 0,
    calculationSnapshot: { ruleType: "bonus_monthly_goal" },
  })]);
  assert.equal(detail.generatedCommission, 0);
  assert.equal(detail.generalCommissions.length, 0);
});

test("net before VAT is shown only from a complete consistent fiscal snapshot", () => {
  assert.equal(getHistoricalSaleNetBeforeTax(liverpoolSale), 500_000);
  assert.equal(getHistoricalSaleNetBeforeTax({ ...liverpoolSale, taxTotal: null }), null);
  assert.equal(getHistoricalSaleNetBeforeTax({ ...liverpoolSale, grandTotal: 579_999 }), null);
});
