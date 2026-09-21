import crypto from "node:crypto";

export const OPERATION_KEY_CONFLICT = "OPERATION_KEY_CONFLICT";
export const LEGACY_OPERATION_KEY_CONFLICT = "LEGACY_OPERATION_KEY_CONFLICT";

export class CriticalOperationIntegrityError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CriticalOperationIntegrityError";
  }
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("OPERATION_FINGERPRINT_NON_FINITE_NUMBER");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    );
  }
  throw new Error("OPERATION_FINGERPRINT_UNSUPPORTED_VALUE");
}

export function serializeCriticalOperationPayload(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function createCriticalOperationFingerprint(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(serializeCriticalOperationPayload(value), "utf8")
    .digest("hex");
}

export function assertCriticalOperationReplay(
  existingFingerprint: string | null | undefined,
  requestedFingerprint: string,
  codes: { legacy: string; conflict: string },
): void {
  if (!existingFingerprint) {
    throw new CriticalOperationIntegrityError(codes.legacy);
  }
  if (existingFingerprint !== requestedFingerprint) {
    throw new CriticalOperationIntegrityError(codes.conflict);
  }
}
