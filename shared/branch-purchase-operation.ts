export const BRANCH_PURCHASE_CREATE_OPERATION = "branch_purchase_create" as const;
export const BRANCH_PURCHASE_PAYMENT_OPERATION = "branch_purchase_payment" as const;
export const BRANCH_PURCHASE_OPERATION_VERSION = 1 as const;
export const BRANCH_PURCHASE_OPERATION_KEY_MIN_LENGTH = 8;
export const BRANCH_PURCHASE_OPERATION_KEY_MAX_LENGTH = 120;
export const BRANCH_PURCHASE_OPERATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type BranchPurchasePaymentStatus = "unpaid" | "partial" | "paid";

export type BranchPurchaseInitialPaymentCanonicalInput = {
  amount: number | string;
  paymentMethod: string;
  entryDate: string;
  reference?: string | null;
  notes?: string | null;
};

export type BranchPurchaseCreateCanonicalInput = {
  branchId: string;
  supplierId?: string | null;
  projectId?: string | null;
  status: string;
  purchaseDate: string;
  expectedDate?: string | null;
  discountAmount: number | string;
  taxMode: string;
  taxRate: number | string;
  reference?: string | null;
  notes?: string | null;
  items: Array<{
    commercialProductId: string;
    quantityOrdered: number;
    unitCost: number | string;
    updateReferenceCost?: boolean;
  }>;
  initialPayment?: BranchPurchaseInitialPaymentCanonicalInput | null;
};

export type BranchPurchasePaymentCanonicalInput = {
  branchId: string;
  purchaseId: string;
  amount: number | string;
  paymentMethod: string;
  entryDate: string;
  reference?: string | null;
  notes?: string | null;
};

function normalizeMaterialText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeIdentifier(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeTaxRate(value: number | string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("BRANCH_PURCHASE_INVALID_TAX_RATE");
  return Number(parsed.toFixed(4));
}

export function normalizeBranchPurchaseOperationKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length < BRANCH_PURCHASE_OPERATION_KEY_MIN_LENGTH
    || normalized.length > BRANCH_PURCHASE_OPERATION_KEY_MAX_LENGTH
    || !BRANCH_PURCHASE_OPERATION_KEY_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function branchPurchaseMoneyToCents(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) throw new Error("BRANCH_PURCHASE_INVALID_AMOUNT");
  return Math.round((parsed + Number.EPSILON) * 100);
}

export function branchPurchaseCentsToFixed(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("BRANCH_PURCHASE_INVALID_AMOUNT");
  return (cents / 100).toFixed(2);
}

function multiplyPositiveIntegerStrings(left: number, right: number): string {
  const leftDigits = String(left).split("").map(Number).reverse();
  const rightDigits = String(right).split("").map(Number).reverse();
  const result = Array(leftDigits.length + rightDigits.length).fill(0) as number[];

  for (let leftIndex = 0; leftIndex < leftDigits.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightDigits.length; rightIndex += 1) {
      result[leftIndex + rightIndex] += leftDigits[leftIndex] * rightDigits[rightIndex];
    }
  }
  for (let index = 0; index < result.length - 1; index += 1) {
    result[index + 1] += Math.floor(result[index] / 10);
    result[index] %= 10;
  }
  while (result.length > 1 && result[result.length - 1] === 0) result.pop();
  return result.reverse().join("");
}

function incrementPositiveIntegerString(value: string): string {
  const digits = value.split("").map(Number);
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    if (digits[index] < 9) {
      digits[index] += 1;
      return digits.join("");
    }
    digits[index] = 0;
  }
  return `1${digits.join("")}`;
}

function dividePositiveIntegerStringRounded(numerator: string, denominator: number): number {
  let remainder = 0;
  let quotient = "";
  for (const character of numerator) {
    remainder = (remainder * 10) + Number(character);
    const digit = Math.floor(remainder / denominator);
    quotient += String(digit);
    remainder -= digit * denominator;
  }
  quotient = quotient.replace(/^0+(?=\d)/, "");
  if (remainder * 2 >= denominator) quotient = incrementPositiveIntegerString(quotient);
  const result = Number(quotient);
  if (!Number.isSafeInteger(result)) throw new Error("BRANCH_PURCHASE_INVALID_REFERENCE_COST_INPUT");
  return result;
}

export function deriveBranchPurchaseReferenceUnitCostCents(input: {
  taxableSubtotal: number | string;
  items: Array<{
    quantityOrdered: number;
    unitCost: number | string;
  }>;
}): number[] {
  const taxableSubtotalCents = branchPurchaseMoneyToCents(input.taxableSubtotal);
  if (!Number.isSafeInteger(taxableSubtotalCents) || taxableSubtotalCents < 0) {
    throw new Error("BRANCH_PURCHASE_INVALID_TAXABLE_SUBTOTAL");
  }

  const normalizedItems = input.items.map((item) => {
    const quantity = Number(item.quantityOrdered);
    const unitCostCents = branchPurchaseMoneyToCents(item.unitCost);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(unitCostCents) || unitCostCents < 0) {
      throw new Error("BRANCH_PURCHASE_INVALID_REFERENCE_COST_INPUT");
    }
    return { quantity, unitCostCents };
  });

  const grossSubtotalCents = normalizedItems.reduce((total, item) => {
    const lineTotalCents = item.unitCostCents * item.quantity;
    if (!Number.isSafeInteger(lineTotalCents) || !Number.isSafeInteger(total + lineTotalCents)) {
      throw new Error("BRANCH_PURCHASE_INVALID_REFERENCE_COST_INPUT");
    }
    return total + lineTotalCents;
  }, 0);
  if (grossSubtotalCents > Number.MAX_SAFE_INTEGER / 10) {
    throw new Error("BRANCH_PURCHASE_INVALID_REFERENCE_COST_INPUT");
  }
  if (grossSubtotalCents === 0) {
    if (taxableSubtotalCents !== 0) throw new Error("BRANCH_PURCHASE_INVALID_TAXABLE_SUBTOTAL");
    return normalizedItems.map(() => 0);
  }

  return normalizedItems.map((item) => dividePositiveIntegerStringRounded(
    multiplyPositiveIntegerStrings(taxableSubtotalCents, item.unitCostCents),
    grossSubtotalCents,
  ));
}

export function deriveBranchPurchasePaymentStatus(
  paidCents: number,
  totalCents: number,
): BranchPurchasePaymentStatus {
  if (paidCents <= 0) return "unpaid";
  if (paidCents < totalCents) return "partial";
  return "paid";
}

export function resolveBranchPurchaseParentPaymentMethod(input: {
  currentPaidCents: number;
  currentPaymentMethod: string | null;
  detailedPaymentMethods: string[];
  newPaymentMethod: string;
}): string | null {
  const newMethod = input.newPaymentMethod.trim().toLowerCase();
  if (input.currentPaidCents <= 0 && input.detailedPaymentMethods.length === 0) {
    return newMethod;
  }

  const currentMethod = input.currentPaymentMethod?.trim().toLowerCase() || null;
  if (!currentMethod || currentMethod !== newMethod) return null;
  if (input.detailedPaymentMethods.some((method) => method.trim().toLowerCase() !== currentMethod)) {
    return null;
  }
  return currentMethod;
}

function buildCanonicalPayment(input: BranchPurchaseInitialPaymentCanonicalInput) {
  return {
    amountCents: branchPurchaseMoneyToCents(input.amount),
    paymentMethod: input.paymentMethod.trim().toLowerCase(),
    entryDate: input.entryDate.trim(),
    reference: normalizeMaterialText(input.reference),
    notes: normalizeMaterialText(input.notes),
  };
}

export function buildBranchPurchaseCreateCanonicalPayload(input: BranchPurchaseCreateCanonicalInput) {
  const items = input.items
    .map((item) => ({
      productId: item.commercialProductId.trim(),
      quantity: item.quantityOrdered,
      unitCostCents: branchPurchaseMoneyToCents(item.unitCost),
      updateReferenceCost: item.updateReferenceCost ?? false,
    }))
    .sort((left, right) => left.productId.localeCompare(right.productId));

  return {
    version: BRANCH_PURCHASE_OPERATION_VERSION,
    operation: BRANCH_PURCHASE_CREATE_OPERATION,
    branchId: input.branchId.trim(),
    supplierId: normalizeIdentifier(input.supplierId),
    projectId: normalizeIdentifier(input.projectId),
    status: input.status.trim().toLowerCase(),
    purchaseDate: input.purchaseDate.trim(),
    expectedDate: normalizeIdentifier(input.expectedDate),
    discountCents: branchPurchaseMoneyToCents(input.discountAmount),
    taxMode: input.taxMode.trim().toLowerCase(),
    taxRate: normalizeTaxRate(input.taxRate),
    reference: normalizeMaterialText(input.reference),
    notes: normalizeMaterialText(input.notes),
    items,
    initialPayment: input.initialPayment ? buildCanonicalPayment(input.initialPayment) : null,
  };
}

export function serializeBranchPurchaseCreateCanonicalPayload(input: BranchPurchaseCreateCanonicalInput): string {
  return JSON.stringify(buildBranchPurchaseCreateCanonicalPayload(input));
}

export function buildBranchPurchasePaymentCanonicalPayload(input: BranchPurchasePaymentCanonicalInput) {
  return {
    version: BRANCH_PURCHASE_OPERATION_VERSION,
    operation: BRANCH_PURCHASE_PAYMENT_OPERATION,
    branchId: input.branchId.trim(),
    purchaseId: input.purchaseId.trim(),
    ...buildCanonicalPayment(input),
  };
}

export function serializeBranchPurchasePaymentCanonicalPayload(input: BranchPurchasePaymentCanonicalInput): string {
  return JSON.stringify(buildBranchPurchasePaymentCanonicalPayload(input));
}

export function getBranchPurchaseLegacyPaidCents(
  aggregatePaidCents: number,
  detailedPaymentsCents: number,
): number {
  return Math.max(0, aggregatePaidCents - detailedPaymentsCents);
}

export function getBranchPurchaseCancellationBlockReason(input: {
  status: string;
  paymentStatus: string;
  paidCents: number;
  paymentRows: number;
  receivedUnits: number;
  inventoryMovements: number;
}): string | null {
  if (input.status !== "draft") return "BRANCH_PURCHASE_CANNOT_CANCEL_STATUS";
  if (input.paymentStatus !== "unpaid" || input.paidCents > 0 || input.paymentRows > 0) {
    return "BRANCH_PURCHASE_CANNOT_CANCEL_PAID";
  }
  if (input.receivedUnits > 0 || input.inventoryMovements > 0) return "BRANCH_PURCHASE_CANNOT_CANCEL_RECEIVED";
  return null;
}
