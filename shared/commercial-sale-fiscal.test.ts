import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateCommercialSaleFiscalSnapshot,
  buildCommercialSaleFiscalSnapshot,
  sumUniqueFinanceFiscalContributions,
  type FinanceFiscalContribution,
  type FinanceFiscalSnapshot,
} from "./commercial-sale-fiscal";

function contribution(
  groupKey: string,
  snapshot: FinanceFiscalSnapshot,
): FinanceFiscalContribution {
  return { groupKey, ...snapshot };
}

test("tax_added sale and cancellation net base, tax and total to zero", () => {
  const input = {
    taxMode: "tax_added",
    taxRate: "16.0000",
    taxableSubtotal: "1000.00",
    taxTotal: "160.00",
    grandTotal: "1160.00",
  };
  const sale = buildCommercialSaleFiscalSnapshot(input, "sale");
  const cancellation = buildCommercialSaleFiscalSnapshot(input, "cancellation");

  assert.deepEqual(sale, {
    taxMode: "tax_added",
    taxRate: 16,
    baseBeforeTax: 1000,
    taxTransferred: 160,
    totalCharged: 1160,
  });
  assert.deepEqual(cancellation, {
    taxMode: "tax_added",
    taxRate: 16,
    baseBeforeTax: -1000,
    taxTransferred: -160,
    totalCharged: -1160,
  });
  assert.deepEqual(
    sumUniqueFinanceFiscalContributions([
      contribution("commercial_sale:sale-1", sale!),
      contribution("commercial_sale_cancellation:sale-1", cancellation!),
    ]),
    { baseBeforeTax: 0, taxTransferred: 0, totalCharged: 0, countedContributions: 2 },
  );
});

test("tax_included preserves the frozen breakdown and reverses it exactly", () => {
  const input = {
    taxMode: "tax_included",
    taxRate: 16,
    taxableSubtotal: 2500,
    taxTotal: 400,
    grandTotal: 2900,
  };

  assert.deepEqual(buildCommercialSaleFiscalSnapshot(input, "sale"), {
    taxMode: "tax_included",
    taxRate: 16,
    baseBeforeTax: 2500,
    taxTransferred: 400,
    totalCharged: 2900,
  });
  assert.deepEqual(buildCommercialSaleFiscalSnapshot(input, "cancellation"), {
    taxMode: "tax_included",
    taxRate: 16,
    baseBeforeTax: -2500,
    taxTransferred: -400,
    totalCharged: -2900,
  });
});

test("tax_exempt always keeps transferred tax at zero", () => {
  const input = {
    taxMode: "tax_exempt",
    taxRate: 0,
    taxableSubtotal: "2500.00",
    taxTotal: "0.00",
    grandTotal: "2500.00",
  };

  assert.equal(buildCommercialSaleFiscalSnapshot(input, "sale")?.taxTransferred, 0);
  assert.deepEqual(buildCommercialSaleFiscalSnapshot(input, "cancellation"), {
    taxMode: "tax_exempt",
    taxRate: 0,
    baseBeforeTax: -2500,
    taxTransferred: 0,
    totalCharged: -2500,
  });
});

test("sale and cancellation remain correct when filtered into separate periods", () => {
  const input = {
    taxMode: "tax_added",
    taxRate: 16,
    taxableSubtotal: 1000,
    taxTotal: 160,
    grandTotal: 1160,
  };
  const sale = buildCommercialSaleFiscalSnapshot(input, "sale")!;
  const cancellation = buildCommercialSaleFiscalSnapshot(input, "cancellation")!;

  assert.deepEqual(
    sumUniqueFinanceFiscalContributions([contribution("commercial_sale:sale-2", sale)]),
    { baseBeforeTax: 1000, taxTransferred: 160, totalCharged: 1160, countedContributions: 1 },
  );
  assert.deepEqual(
    sumUniqueFinanceFiscalContributions([contribution("commercial_sale_cancellation:sale-2", cancellation)]),
    { baseBeforeTax: -1000, taxTransferred: -160, totalCharged: -1160, countedContributions: 1 },
  );
});

test("multiple payment rows count a commercial sale snapshot once", () => {
  const sale = buildCommercialSaleFiscalSnapshot({
    taxMode: "tax_added",
    taxRate: 16,
    taxableSubtotal: 1000,
    taxTotal: 160,
    grandTotal: 1160,
  }, "sale")!;

  assert.deepEqual(allocateCommercialSaleFiscalSnapshot(sale, 580), {
    taxMode: "tax_added",
    taxRate: 16,
    baseBeforeTax: 500,
    taxTransferred: 80,
    totalCharged: 580,
  });
  assert.deepEqual(
    sumUniqueFinanceFiscalContributions([
      contribution("commercial_sale:sale-3", sale),
      contribution("commercial_sale:sale-3", sale),
    ]),
    { baseBeforeTax: 1000, taxTransferred: 160, totalCharged: 1160, countedContributions: 1 },
  );
});

test("duplicate cancellation rows count the reversal once", () => {
  const cancellation = buildCommercialSaleFiscalSnapshot({
    taxMode: "tax_included",
    taxRate: 16,
    taxableSubtotal: 1000,
    taxTotal: 160,
    grandTotal: 1160,
  }, "cancellation")!;

  assert.deepEqual(
    sumUniqueFinanceFiscalContributions([
      contribution("commercial_sale_cancellation:sale-4", cancellation),
      contribution("commercial_sale_cancellation:sale-4", cancellation),
    ]),
    { baseBeforeTax: -1000, taxTransferred: -160, totalCharged: -1160, countedContributions: 1 },
  );
});

test("legacy or contradictory snapshots do not invent fiscal values", () => {
  assert.equal(buildCommercialSaleFiscalSnapshot({ taxMode: "tax_added" }, "sale"), null);
  assert.equal(buildCommercialSaleFiscalSnapshot({
    taxMode: "tax_exempt",
    taxRate: 0,
    taxableSubtotal: 100,
    taxTotal: 16,
    grandTotal: 116,
  }, "sale"), null);
  assert.equal(buildCommercialSaleFiscalSnapshot({
    taxMode: "tax_added",
    taxRate: 16,
    taxableSubtotal: 100,
    taxTotal: 15,
    grandTotal: 116,
  }, "sale"), null);
});

test("money values are rounded and aggregated in exact cents", () => {
  const sale = buildCommercialSaleFiscalSnapshot({
    taxMode: "tax_added",
    taxRate: "16.0000",
    taxableSubtotal: "0.29",
    taxTotal: "0.05",
    grandTotal: "0.34",
  }, "sale")!;
  const cancellation = buildCommercialSaleFiscalSnapshot({
    taxMode: "tax_added",
    taxRate: "16.0000",
    taxableSubtotal: "0.29",
    taxTotal: "0.05",
    grandTotal: "0.34",
  }, "cancellation")!;

  assert.deepEqual(
    sumUniqueFinanceFiscalContributions([
      contribution("commercial_sale:sale-cent", sale),
      contribution("commercial_sale_cancellation:sale-cent", cancellation),
    ]),
    { baseBeforeTax: 0, taxTransferred: 0, totalCharged: 0, countedContributions: 2 },
  );
});
