import crypto from "crypto";
import {
  serializeQuickChargeCanonicalPayload,
  type QuickChargeCanonicalPayloadInput,
} from "@shared/quick-charge";

export const QUICK_CHARGE_OPERATION_KEY_CONFLICT = "QUICK_CHARGE_OPERATION_KEY_CONFLICT";
export const QUICK_CHARGE_LEGACY_OPERATION_KEY_CONFLICT = "QUICK_CHARGE_LEGACY_OPERATION_KEY_CONFLICT";
export const QUICK_CHARGE_INCOMPLETE_REPLAY_CONFLICT = "QUICK_CHARGE_INCOMPLETE_REPLAY_CONFLICT";

export function maskQuickChargeOperationKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) return "********";
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

export class QuickChargeIdempotencyError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "QuickChargeIdempotencyError";
  }
}

export function createQuickChargePayloadFingerprint(input: QuickChargeCanonicalPayloadInput): string {
  return crypto
    .createHash("sha256")
    .update(serializeQuickChargeCanonicalPayload(input), "utf8")
    .digest("hex");
}

type LockedQuickChargeOperationOptions<TContext, TExisting, TResult> = {
  fingerprint: string;
  transaction: (work: (context: TContext) => Promise<TResult>) => Promise<TResult>;
  acquireLock: (context: TContext) => Promise<(() => void) | void>;
  findExisting: (context: TContext) => Promise<TExisting | undefined>;
  getExistingFingerprint: (existing: TExisting) => string | null;
  replay: (context: TContext, existing: TExisting) => Promise<TResult>;
  create: (context: TContext) => Promise<TResult>;
};

export async function commitLockedQuickChargeOperation<TContext, TExisting, TResult>(
  options: LockedQuickChargeOperationOptions<TContext, TExisting, TResult>,
): Promise<{ result: TResult; replayed: boolean }> {
  let replayed = false;

  const result = await options.transaction(async (context) => {
    const release = await options.acquireLock(context);
    try {
      const existing = await options.findExisting(context);
      if (!existing) {
        return options.create(context);
      }

      const existingFingerprint = options.getExistingFingerprint(existing);
      if (!existingFingerprint) {
        throw new QuickChargeIdempotencyError(QUICK_CHARGE_LEGACY_OPERATION_KEY_CONFLICT);
      }
      if (existingFingerprint !== options.fingerprint) {
        throw new QuickChargeIdempotencyError(QUICK_CHARGE_OPERATION_KEY_CONFLICT);
      }

      replayed = true;
      return options.replay(context, existing);
    } finally {
      release?.();
    }
  });

  return { result, replayed };
}
