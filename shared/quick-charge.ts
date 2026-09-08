export const QUICK_CHARGE_OPERATION_DOMAIN = "service_sale" as const;
export const QUICK_CHARGE_OPERATION_SNAPSHOT_VERSION = 1 as const;
export const QUICK_CHARGE_OPERATION_KEY_MIN_LENGTH = 8;
export const QUICK_CHARGE_OPERATION_KEY_MAX_LENGTH = 120;
export const QUICK_CHARGE_OPERATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type QuickChargeCanonicalPayloadInput = {
  planId: string;
  customerName: string;
  whatsapp?: string | null;
  paymentMethod: string;
  note?: string | null;
  entryDate: string;
};

function normalizeMaterialText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return normalized || null;
}

export function normalizeQuickChargePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("521") && digits.length === 13) return `52${digits.slice(3)}`;
  if (digits.startsWith("52")) return digits;
  if (digits.startsWith("1") && digits.length === 11) return `52${digits.slice(1)}`;
  if (digits.length === 10) return `52${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function normalizeQuickChargeOperationKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length < QUICK_CHARGE_OPERATION_KEY_MIN_LENGTH
    || normalized.length > QUICK_CHARGE_OPERATION_KEY_MAX_LENGTH
    || !QUICK_CHARGE_OPERATION_KEY_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function getQuickChargePhoneLockToken(value: unknown): string | null {
  const normalizedPhone = normalizeQuickChargePhone(value);
  return normalizedPhone ? `quick-charge-phone:${normalizedPhone}` : null;
}

export function buildQuickChargeCanonicalPayload(input: QuickChargeCanonicalPayloadInput) {
  return {
    version: QUICK_CHARGE_OPERATION_SNAPSHOT_VERSION,
    domain: QUICK_CHARGE_OPERATION_DOMAIN,
    planId: input.planId.trim(),
    customerName: normalizeMaterialText(input.customerName) ?? "",
    whatsapp: normalizeQuickChargePhone(input.whatsapp),
    paymentMethod: input.paymentMethod.trim().toLowerCase(),
    note: normalizeMaterialText(input.note),
    entryDate: input.entryDate.trim(),
  };
}

export function serializeQuickChargeCanonicalPayload(input: QuickChargeCanonicalPayloadInput): string {
  return JSON.stringify(buildQuickChargeCanonicalPayload(input));
}
