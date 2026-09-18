import assert from "node:assert/strict";
import test from "node:test";
import { computeMembershipPlanChargeSnapshot } from "./membership-plan-tax";

type TaxMode = "tax_exempt" | "tax_added" | "tax_included";
type Input = {
  subtotal: string;
  discount: string;
  taxMode: TaxMode;
  taxRate: string;
};
type ContractAmounts = {
  subtotalBeforeTaxCents: number;
  taxableSubtotalCents: number;
  taxTotalCents: number;
  grandTotalCents: number;
};

const MAX_NUMERIC_12_2_CENTS = 999_999_999_999n;
const RATE_DENOMINATOR = 1_000_000n;

function moneyCents(value: string): bigint {
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("INVALID_MONEY_INPUT");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
}

function rateScaled(value: string): bigint {
  if (!/^(0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value)) {
    throw new Error("INVALID_TAX_RATE");
  }
  const [whole, fraction = ""] = value.split(".");
  const scaled = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0") || "0");
  if (scaled > 1_000_000n) throw new Error("INVALID_TAX_RATE");
  return scaled;
}

function roundPositiveRatio(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

// Independent decimal interpretation of the proposed PostgreSQL CHECK formulas.
function sqlContractAmounts(input: Input): ContractAmounts {
  const subtotal = moneyCents(input.subtotal);
  const discount = moneyCents(input.discount);
  const rate = rateScaled(input.taxRate);
  if (subtotal <= 0n || subtotal > MAX_NUMERIC_12_2_CENTS || discount >= subtotal) {
    throw new Error("INVALID_OBLIGATION_AMOUNT");
  }
  if (input.taxMode === "tax_exempt" ? rate !== 0n : rate === 0n) {
    throw new Error("INVALID_TAX_MODE_RATE");
  }

  const discounted = subtotal - discount;
  let subtotalBeforeTax = subtotal;
  let taxableSubtotal = discounted;
  let taxTotal = 0n;
  let grandTotal = discounted;

  if (input.taxMode === "tax_added") {
    taxTotal = roundPositiveRatio(taxableSubtotal * rate, RATE_DENOMINATOR);
    grandTotal = taxableSubtotal + taxTotal;
  } else if (input.taxMode === "tax_included") {
    subtotalBeforeTax = roundPositiveRatio(
      subtotal * RATE_DENOMINATOR,
      RATE_DENOMINATOR + rate,
    );
    taxableSubtotal = roundPositiveRatio(
      discounted * RATE_DENOMINATOR,
      RATE_DENOMINATOR + rate,
    );
    taxTotal = discounted - taxableSubtotal;
  }
  if (grandTotal > MAX_NUMERIC_12_2_CENTS) {
    throw new Error("NUMERIC_12_2_TOTAL_OVERFLOW");
  }
  return {
    subtotalBeforeTaxCents: Number(subtotalBeforeTax),
    taxableSubtotalCents: Number(taxableSubtotal),
    taxTotalCents: Number(taxTotal),
    grandTotalCents: Number(grandTotal),
  };
}

function pureHelperAmounts(input: Input): ContractAmounts {
  const subtotal = Number(moneyCents(input.subtotal));
  const discounted = subtotal - Number(moneyCents(input.discount));
  const options = { taxMode: input.taxMode, taxRate: Number(input.taxRate) };
  const before = computeMembershipPlanChargeSnapshot({ priceCents: subtotal, ...options });
  const after = computeMembershipPlanChargeSnapshot({ priceCents: discounted, ...options });
  return {
    subtotalBeforeTaxCents: before.subtotalBeforeTaxCents!,
    taxableSubtotalCents: after.taxableSubtotalCents!,
    taxTotalCents: after.taxTotalCents!,
    grandTotalCents: after.finalTotalCents,
  };
}

function sqlContractAcceptsAmounts(input: Input, amounts: ContractAmounts): boolean {
  try {
    const required = sqlContractAmounts(input);
    return Object.keys(required).every((key) =>
      amounts[key as keyof ContractAmounts] === required[key as keyof ContractAmounts]);
  } catch {
    return false;
  }
}

function moneyFromCents(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function paymentAmountCents(value: string): number {
  const amount = moneyCents(value);
  if (amount <= 0n || amount > MAX_NUMERIC_12_2_CENTS) {
    throw new Error("INVALID_OBLIGATION_PAYMENT");
  }
  return Number(amount);
}

const fixtures: Array<{ name: string; input: Input; expected: ContractAmounts }> = [
  {
    name: "IVA agregado: 1000 + 160 = 1160",
    input: { subtotal: "1000.00", discount: "0.00", taxMode: "tax_added", taxRate: "16" },
    expected: { subtotalBeforeTaxCents: 100_000, taxableSubtotalCents: 100_000, taxTotalCents: 16_000, grandTotalCents: 116_000 },
  },
  {
    name: "IVA incluido: 1160 contiene 1000 + 160",
    input: { subtotal: "1160.00", discount: "0.00", taxMode: "tax_included", taxRate: "16" },
    expected: { subtotalBeforeTaxCents: 100_000, taxableSubtotalCents: 100_000, taxTotalCents: 16_000, grandTotalCents: 116_000 },
  },
  {
    name: "IVA incluido: 50 contiene 43.10 + 6.90",
    input: { subtotal: "50.00", discount: "0.00", taxMode: "tax_included", taxRate: "16" },
    expected: { subtotalBeforeTaxCents: 4_310, taxableSubtotalCents: 4_310, taxTotalCents: 690, grandTotalCents: 5_000 },
  },
  {
    name: "descuento con IVA agregado",
    input: { subtotal: "1000.00", discount: "100.00", taxMode: "tax_added", taxRate: "16" },
    expected: { subtotalBeforeTaxCents: 100_000, taxableSubtotalCents: 90_000, taxTotalCents: 14_400, grandTotalCents: 104_400 },
  },
  {
    name: "descuento con IVA incluido",
    input: { subtotal: "1160.00", discount: "116.00", taxMode: "tax_included", taxRate: "16" },
    expected: { subtotalBeforeTaxCents: 100_000, taxableSubtotalCents: 90_000, taxTotalCents: 14_400, grandTotalCents: 104_400 },
  },
  {
    name: "sin IVA ni descuento",
    input: { subtotal: "1000.00", discount: "0.00", taxMode: "tax_exempt", taxRate: "0" },
    expected: { subtotalBeforeTaxCents: 100_000, taxableSubtotalCents: 100_000, taxTotalCents: 0, grandTotalCents: 100_000 },
  },
  {
    name: "sin IVA con descuento",
    input: { subtotal: "1000.00", discount: "100.00", taxMode: "tax_exempt", taxRate: "0" },
    expected: { subtotalBeforeTaxCents: 100_000, taxableSubtotalCents: 90_000, taxTotalCents: 0, grandTotalCents: 90_000 },
  },
  {
    name: "un centavo de IVA agregado al 50%, empate se redondea arriba",
    input: { subtotal: "0.01", discount: "0.00", taxMode: "tax_added", taxRate: "50" },
    expected: { subtotalBeforeTaxCents: 1, taxableSubtotalCents: 1, taxTotalCents: 1, grandTotalCents: 2 },
  },
  {
    name: "tres centavos con IVA incluido al 100%, empate se redondea arriba",
    input: { subtotal: "0.03", discount: "0.00", taxMode: "tax_included", taxRate: "100" },
    expected: { subtotalBeforeTaxCents: 2, taxableSubtotalCents: 2, taxTotalCents: 1, grandTotalCents: 3 },
  },
  {
    name: "IVA agregado con tasa de cuatro decimales",
    input: { subtotal: "1000.00", discount: "0.00", taxMode: "tax_added", taxRate: "16.1234" },
    expected: { subtotalBeforeTaxCents: 100_000, taxableSubtotalCents: 100_000, taxTotalCents: 16_123, grandTotalCents: 116_123 },
  },
  {
    name: "IVA incluido con tasa de cuatro decimales",
    input: { subtotal: "1161.23", discount: "0.00", taxMode: "tax_included", taxRate: "16.1234" },
    expected: { subtotalBeforeTaxCents: 100_000, taxableSubtotalCents: 100_000, taxTotalCents: 16_123, grandTotalCents: 116_123 },
  },
];

for (const fixture of fixtures) {
  test(fixture.name, () => {
    assert.deepEqual(sqlContractAmounts(fixture.input), fixture.expected);
    assert.deepEqual(pureHelperAmounts(fixture.input), fixture.expected);
  });
}

test("SQL contract rejects an inconsistent pre-discount subtotal", () => {
  const correct = sqlContractAmounts({ subtotal: "1000.00", discount: "0.00", taxMode: "tax_added", taxRate: "16" });
  assert.equal(
    sqlContractAcceptsAmounts(
      { subtotal: "1000.00", discount: "0.00", taxMode: "tax_added", taxRate: "16" },
      { ...correct, subtotalBeforeTaxCents: 999_900 },
    ),
    false,
  );
  assert.equal(sqlContractAcceptsAmounts(
    { subtotal: "1000.00", discount: "0.00", taxMode: "tax_added", taxRate: "16" },
    correct,
  ), true);
  assert.equal(correct.subtotalBeforeTaxCents, 100_000);
});

test("numeric(12,2) accepts its maximum without IVA and rejects tax-added overflow", () => {
  assert.equal(
    sqlContractAmounts({ subtotal: "9999999999.99", discount: "0.00", taxMode: "tax_exempt", taxRate: "0" }).grandTotalCents,
    Number(MAX_NUMERIC_12_2_CENTS),
  );
  assert.throws(
    () => sqlContractAmounts({ subtotal: "9999999999.99", discount: "0.00", taxMode: "tax_added", taxRate: "16" }),
    /NUMERIC_12_2_TOTAL_OVERFLOW/,
  );
  assert.throws(
    () => sqlContractAmounts({ subtotal: "10000000000.00", discount: "0.00", taxMode: "tax_exempt", taxRate: "0" }),
    /INVALID_OBLIGATION_AMOUNT/,
  );
  assert.ok(
    pureHelperAmounts({ subtotal: "9999999999.99", discount: "0.00", taxMode: "tax_added", taxRate: "16" }).grandTotalCents
      > Number(MAX_NUMERIC_12_2_CENTS),
    "The pure plan helper calculates tax, but does not enforce numeric(12,2)",
  );
  assert.equal(
    sqlContractAmounts({ subtotal: "8000000000.00", discount: "0.00", taxMode: "tax_added", taxRate: "16" }).grandTotalCents,
    928_000_000_000,
  );
});

test("near numeric(12,2) limit, included-tax helper matches exact decimal contract", () => {
  const input: Input = { subtotal: "9999999999.99", discount: "0.00", taxMode: "tax_included", taxRate: "16.1234" };
  assert.deepEqual(pureHelperAmounts(input), sqlContractAmounts(input));
});

test("near the numeric limit, sampled rates agree with exact scaled arithmetic", () => {
  for (const taxRate of ["16", "16.1234", "99.9999"]) {
    for (let offset = 0n; offset < 200n; offset++) {
      const input: Input = {
        subtotal: moneyFromCents(MAX_NUMERIC_12_2_CENTS - offset),
        discount: "0.00",
        taxMode: "tax_included",
        taxRate,
      };
      assert.deepEqual(pureHelperAmounts(input), sqlContractAmounts(input), `${taxRate} at offset ${offset}`);
    }
  }
});

test("non-finite values, negatives, invalid discounts and rates are rejected", () => {
  for (const subtotal of ["NaN", "Infinity", "-Infinity", "-1.00", "0.00"]) {
    assert.throws(() => sqlContractAmounts({ subtotal, discount: "0.00", taxMode: "tax_exempt", taxRate: "0" }));
  }
  for (const discount of ["NaN", "Infinity", "-1.00", "1000.00", "1000.01"]) {
    assert.throws(() => sqlContractAmounts({ subtotal: "1000.00", discount, taxMode: "tax_added", taxRate: "16" }));
  }
  for (const taxRate of ["NaN", "Infinity", "-1", "101", "16.12345", "0"]) {
    assert.throws(() => sqlContractAmounts({ subtotal: "1000.00", discount: "0.00", taxMode: "tax_added", taxRate }));
  }
  for (const priceCents of [NaN, Infinity, -Infinity, -1]) {
    assert.throws(() => computeMembershipPlanChargeSnapshot({ priceCents, taxMode: "tax_added", taxRate: 16 }));
  }
  for (const taxRate of [NaN, Infinity, -Infinity]) {
    assert.throws(() => computeMembershipPlanChargeSnapshot({ priceCents: 100_000, taxMode: "tax_added", taxRate }));
  }
});

test("payment amount contract rejects non-finite, negative, zero and over-limit values", () => {
  assert.equal(paymentAmountCents("500.00"), 50_000);
  for (const payment of ["NaN", "Infinity", "-Infinity", "-1.00", "0.00", "10000000000.00"]) {
    assert.throws(() => paymentAmountCents(payment));
  }
});
