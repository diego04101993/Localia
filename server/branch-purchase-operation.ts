import crypto from "crypto";
import {
  serializeBranchPurchaseCreateCanonicalPayload,
  serializeBranchPurchasePaymentCanonicalPayload,
  type BranchPurchaseCreateCanonicalInput,
  type BranchPurchasePaymentCanonicalInput,
} from "@shared/branch-purchase-operation";

export const BRANCH_PURCHASE_OPERATION_KEY_CONFLICT = "BRANCH_PURCHASE_OPERATION_KEY_CONFLICT";
export const BRANCH_PURCHASE_LEGACY_OPERATION_KEY_CONFLICT = "BRANCH_PURCHASE_LEGACY_OPERATION_KEY_CONFLICT";
export const BRANCH_PURCHASE_INCOMPLETE_REPLAY_CONFLICT = "BRANCH_PURCHASE_INCOMPLETE_REPLAY_CONFLICT";

export class BranchPurchaseIdempotencyError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BranchPurchaseIdempotencyError";
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function createBranchPurchasePayloadFingerprint(input: BranchPurchaseCreateCanonicalInput): string {
  return sha256(serializeBranchPurchaseCreateCanonicalPayload(input));
}

export function createBranchPurchasePaymentFingerprint(input: BranchPurchasePaymentCanonicalInput): string {
  return sha256(serializeBranchPurchasePaymentCanonicalPayload(input));
}

type LockedBranchPurchaseOperationOptions<TContext, TExisting, TResult> = {
  fingerprint: string;
  transaction: (work: (context: TContext) => Promise<TResult>) => Promise<TResult>;
  acquireLock: (context: TContext) => Promise<(() => void) | void>;
  findExisting: (context: TContext) => Promise<TExisting | undefined>;
  getExistingFingerprint: (existing: TExisting) => string | null;
  replay: (context: TContext, existing: TExisting) => Promise<TResult>;
  create: (context: TContext) => Promise<TResult>;
};

export async function commitLockedBranchPurchaseOperation<TContext, TExisting, TResult>(
  options: LockedBranchPurchaseOperationOptions<TContext, TExisting, TResult>,
): Promise<{ result: TResult; replayed: boolean }> {
  let replayed = false;
  const result = await options.transaction(async (context) => {
    const release = await options.acquireLock(context);
    try {
      const existing = await options.findExisting(context);
      if (!existing) return options.create(context);

      const existingFingerprint = options.getExistingFingerprint(existing);
      if (!existingFingerprint) {
        throw new BranchPurchaseIdempotencyError(BRANCH_PURCHASE_LEGACY_OPERATION_KEY_CONFLICT);
      }
      if (existingFingerprint !== options.fingerprint) {
        throw new BranchPurchaseIdempotencyError(BRANCH_PURCHASE_OPERATION_KEY_CONFLICT);
      }

      replayed = true;
      return options.replay(context, existing);
    } finally {
      release?.();
    }
  });

  return { result, replayed };
}
