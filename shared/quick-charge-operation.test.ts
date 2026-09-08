import assert from "node:assert/strict";
import test from "node:test";
import {
  beginStableOperationAttempt,
  markStableOperationError,
  markStableOperationSuccess,
  type OperationAttemptState,
} from "../client/src/lib/stable-operation-key";
import { isProtectedFinanceSource } from "./finance-source";
import { computeMembershipPlanChargeSnapshot } from "./membership-plan-tax";
import { quickChargeSingleSessionSchema } from "./schema";
import {
  buildQuickChargeCanonicalPayload,
  getQuickChargePhoneLockToken,
  normalizeQuickChargePhone,
  QUICK_CHARGE_OPERATION_KEY_MAX_LENGTH,
  serializeQuickChargeCanonicalPayload,
} from "./quick-charge";
import {
  commitLockedQuickChargeOperation,
  createQuickChargePayloadFingerprint,
  QuickChargeIdempotencyError,
  QUICK_CHARGE_INCOMPLETE_REPLAY_CONFLICT,
  QUICK_CHARGE_LEGACY_OPERATION_KEY_CONFLICT,
  QUICK_CHARGE_OPERATION_KEY_CONFLICT,
} from "../server/quick-charge-operation";

type StoredOperation = {
  fingerprint: string | null;
  result: { financeEntryId: string; clientUserId: string; membershipId: string };
  deletedAt?: string | null;
  missingReplayPart?: "metadata" | "membership" | "crm" | "audit";
};

type FakeState = {
  users: string[];
  memberships: string[];
  crm: string[];
  finance: string[];
  audit: string[];
  operations: Map<string, StoredOperation>;
};

type FailureStage = "after_client" | "after_membership_crm" | "before_finance" | "after_finance";

function cloneState(state: FakeState): FakeState {
  return {
    users: [...state.users],
    memberships: [...state.memberships],
    crm: [...state.crm],
    finance: [...state.finance],
    audit: [...state.audit],
    operations: new Map(state.operations),
  };
}

function createMutex() {
  let queue = Promise.resolve();
  return async function acquire() {
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = queue;
    queue = queue.then(() => current);
    await previous;
    return release;
  };
}

function createHarness(initial?: Partial<FakeState>) {
  let state: FakeState = {
    users: initial?.users ?? [],
    memberships: initial?.memberships ?? [],
    crm: initial?.crm ?? [],
    finance: initial?.finance ?? [],
    audit: initial?.audit ?? [],
    operations: initial?.operations ?? new Map(),
  };
  const acquireTransaction = createMutex();
  let createCount = 0;
  let lockCount = 0;

  async function execute(params: {
    branchId: string;
    operationKey: string;
    payload: Parameters<typeof createQuickChargePayloadFingerprint>[0];
    clientMode?: "existing" | "crm_only" | "new";
    failAt?: FailureStage;
    validateMutableState?: () => void;
  }) {
    const scope = `${params.branchId}:service_sale:${params.operationKey}`;
    const fingerprint = createQuickChargePayloadFingerprint(params.payload);

    return commitLockedQuickChargeOperation<FakeState, StoredOperation, StoredOperation["result"]>({
      fingerprint,
      transaction: async (work) => {
        const release = await acquireTransaction();
        const draft = cloneState(state);
        try {
          const result = await work(draft);
          state = draft;
          return result;
        } finally {
          release();
        }
      },
      acquireLock: async () => {
        lockCount += 1;
      },
      findExisting: async (draft) => draft.operations.get(scope),
      getExistingFingerprint: (existing) => existing.deletedAt ? null : existing.fingerprint,
      replay: async (_draft, existing) => {
        if (existing.missingReplayPart) {
          throw new QuickChargeIdempotencyError(QUICK_CHARGE_INCOMPLETE_REPLAY_CONFLICT);
        }
        return existing.result;
      },
      create: async (draft) => {
        params.validateMutableState?.();
        createCount += 1;
        const suffix = `${params.branchId}-${createCount}`;
        const clientUserId = params.clientMode === "existing"
          ? "existing-user"
          : params.clientMode === "crm_only"
            ? "crm-only-user"
            : `user-${suffix}`;
        const membershipId = params.clientMode === "existing" ? "existing-membership" : `membership-${suffix}`;

        if (params.clientMode !== "existing" && params.clientMode !== "crm_only") draft.users.push(clientUserId);
        if (params.failAt === "after_client") throw new Error("FAIL_AFTER_CLIENT");

        if (params.clientMode !== "existing") draft.memberships.push(membershipId);
        if (!draft.crm.includes(clientUserId)) draft.crm.push(clientUserId);
        if (params.failAt === "after_membership_crm") throw new Error("FAIL_AFTER_MEMBERSHIP_CRM");
        if (params.failAt === "before_finance") throw new Error("FAIL_BEFORE_FINANCE");

        const financeEntryId = `finance-${suffix}`;
        draft.finance.push(financeEntryId);
        draft.operations.set(scope, {
          fingerprint,
          result: { financeEntryId, clientUserId, membershipId },
        });
        if (params.failAt === "after_finance") throw new Error("FAIL_AFTER_FINANCE");

        draft.audit.push(`audit-${suffix}`);
        return { financeEntryId, clientUserId, membershipId };
      },
    });
  }

  return {
    execute,
    getState: () => state,
    getCreateCount: () => createCount,
    getLockCount: () => lockCount,
  };
}

function createKeyedMutex() {
  const mutexes = new Map<string, ReturnType<typeof createMutex>>();
  return (key: string) => {
    let acquire = mutexes.get(key);
    if (!acquire) {
      acquire = createMutex();
      mutexes.set(key, acquire);
    }
    return acquire();
  };
}

function createPhoneConcurrencyHarness() {
  const acquireOperationLock = createKeyedMutex();
  const acquirePhoneLock = createKeyedMutex();
  const operations = new Map<string, StoredOperation>();
  const usersByPhone = new Map<string, string>();
  const memberships: string[] = [];
  const crm: string[] = [];
  const finance: string[] = [];
  const audit: string[] = [];
  const lockOrder = new Map<string, string[]>();
  let clientSequence = 0;

  async function execute(params: {
    branchId: string;
    operationKey: string;
    phone: string;
  }) {
    const operationScope = `${params.branchId}:service_sale:${params.operationKey}`;
    const normalizedPhone = normalizeQuickChargePhone(params.phone);
    const phoneLockToken = getQuickChargePhoneLockToken(params.phone);
    assert.ok(normalizedPhone);
    assert.ok(phoneLockToken);
    lockOrder.set(params.operationKey, []);

    return commitLockedQuickChargeOperation<void, StoredOperation, StoredOperation["result"]>({
      fingerprint: createQuickChargePayloadFingerprint({ ...basePayload, whatsapp: params.phone }),
      transaction: async (work) => work(),
      acquireLock: async () => {
        const release = await acquireOperationLock(operationScope);
        lockOrder.get(params.operationKey)!.push("operation");
        return release;
      },
      findExisting: async () => operations.get(operationScope),
      getExistingFingerprint: (existing) => existing.fingerprint,
      replay: async (_context, existing) => existing.result,
      create: async () => {
        const phoneScope = `${params.branchId}:${phoneLockToken}`;
        const releasePhone = await acquirePhoneLock(phoneScope);
        lockOrder.get(params.operationKey)!.push("phone");
        try {
          let clientUserId = usersByPhone.get(phoneScope);
          if (!clientUserId) {
            clientUserId = `phone-user-${++clientSequence}`;
            usersByPhone.set(phoneScope, clientUserId);
            memberships.push(`membership-${clientUserId}`);
            crm.push(`crm-${clientUserId}`);
          }

          const result = {
            financeEntryId: `finance-${params.operationKey}`,
            clientUserId,
            membershipId: `membership-${clientUserId}`,
          };
          finance.push(result.financeEntryId);
          audit.push(`audit-${params.operationKey}`);
          operations.set(operationScope, {
            fingerprint: createQuickChargePayloadFingerprint({ ...basePayload, whatsapp: params.phone }),
            result,
          });
          return result;
        } finally {
          releasePhone();
        }
      },
    });
  }

  return {
    execute,
    getState: () => ({ usersByPhone, memberships, crm, finance, audit, operations, lockOrder }),
  };
}

const basePayload = {
  planId: "plan-1",
  customerName: "María López",
  whatsapp: "55 1234 5678",
  paymentMethod: "efectivo",
  note: "Sesión individual",
  entryDate: "2026-08-30",
};

test("quick charge canonicalization is stable and the persisted fingerprint contains no plaintext identity", () => {
  const canonicalA = buildQuickChargeCanonicalPayload(basePayload);
  const canonicalB = buildQuickChargeCanonicalPayload({
    ...basePayload,
    customerName: "  María   López  ",
    whatsapp: "+52 (55) 1234-5678",
  });
  assert.deepEqual(canonicalA, canonicalB);
  assert.equal(serializeQuickChargeCanonicalPayload(basePayload), JSON.stringify(canonicalA));

  const fingerprint = createQuickChargePayloadFingerprint(basePayload);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint.includes("María"), false);
  assert.equal(fingerprint.includes("5512345678"), false);
});

test("operationKey and legacy requestId follow one strict compatibility contract", () => {
  const request = {
    customerName: "Cliente Prueba",
    paymentMethod: "efectivo" as const,
  };

  assert.equal(quickChargeSingleSessionSchema.safeParse({ ...request, operationKey: "operation-key" }).success, true);
  assert.equal(quickChargeSingleSessionSchema.safeParse({ ...request, requestId: "request-key" }).success, true);
  assert.equal(quickChargeSingleSessionSchema.safeParse({
    ...request,
    operationKey: "shared-key",
    requestId: "shared-key",
  }).success, true);

  let storageCalls = 0;
  const mismatch = quickChargeSingleSessionSchema.safeParse({
    ...request,
    operationKey: "operation-key",
    requestId: "different-key",
  });
  if (mismatch.success) storageCalls += 1;
  assert.equal(mismatch.success, false);
  assert.equal(storageCalls, 0);
});

test("operation keys fit source_id and reject empty, oversized or unsafe values", () => {
  const request = {
    customerName: "Cliente Prueba",
    paymentMethod: "efectivo" as const,
  };
  const maxLengthKey = `a${"b".repeat(QUICK_CHARGE_OPERATION_KEY_MAX_LENGTH - 1)}`;
  const trimmed = quickChargeSingleSessionSchema.safeParse({
    ...request,
    operationKey: "  valid-key_01:retry.2  ",
  });

  assert.equal(QUICK_CHARGE_OPERATION_KEY_MAX_LENGTH, 120);
  assert.equal(quickChargeSingleSessionSchema.safeParse({ ...request, operationKey: maxLengthKey }).success, true);
  assert.equal(quickChargeSingleSessionSchema.safeParse({ ...request, operationKey: `${maxLengthKey}x` }).success, false);
  assert.equal(quickChargeSingleSessionSchema.safeParse({ ...request, operationKey: "" }).success, false);
  assert.equal(quickChargeSingleSessionSchema.safeParse({ ...request, operationKey: "        " }).success, false);
  assert.equal(quickChargeSingleSessionSchema.safeParse({ ...request, operationKey: "unsafe key" }).success, false);
  assert.equal(quickChargeSingleSessionSchema.safeParse({ ...request, operationKey: "unsafe/key" }).success, false);
  assert.equal(trimmed.success, true);
  if (trimmed.success) assert.equal(trimmed.data.operationKey, "valid-key_01:retry.2");
});

test("normal operation with an existing client creates only CRM, finance and audit effects", async () => {
  const harness = createHarness({ users: ["existing-user"], memberships: ["existing-membership"] });
  const result = await harness.execute({
    branchId: "branch-a",
    operationKey: "operation-existing",
    payload: basePayload,
    clientMode: "existing",
  });

  assert.equal(result.replayed, false);
  assert.deepEqual(harness.getState().users, ["existing-user"]);
  assert.deepEqual(harness.getState().memberships, ["existing-membership"]);
  assert.equal(harness.getState().crm.length, 1);
  assert.equal(harness.getState().finance.length, 1);
  assert.equal(harness.getState().audit.length, 1);
});

test("normal operation with a new client creates every related record once", async () => {
  const harness = createHarness();
  await harness.execute({ branchId: "branch-a", operationKey: "operation-new", payload: basePayload, clientMode: "new" });

  assert.equal(harness.getState().users.length, 1);
  assert.equal(harness.getState().memberships.length, 1);
  assert.equal(harness.getState().crm.length, 1);
  assert.equal(harness.getState().finance.length, 1);
  assert.equal(harness.getState().audit.length, 1);
});

test("a CRM-only branch client is reused and receives one membership without duplicating the user", async () => {
  const harness = createHarness({ users: ["crm-only-user"], crm: ["crm-only-user"] });
  await harness.execute({
    branchId: "branch-a",
    operationKey: "operation-crm-only",
    payload: basePayload,
    clientMode: "crm_only",
  });

  assert.deepEqual(harness.getState().users, ["crm-only-user"]);
  assert.equal(harness.getState().memberships.length, 1);
  assert.deepEqual(harness.getState().crm, ["crm-only-user"]);
  assert.equal(harness.getState().finance.length, 1);
});

test("same key and same payload replays without duplicate writes", async () => {
  const harness = createHarness();
  const first = await harness.execute({ branchId: "branch-a", operationKey: "operation-replay", payload: basePayload });
  const second = await harness.execute({ branchId: "branch-a", operationKey: "operation-replay", payload: basePayload });

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual(second.result, first.result);
  assert.equal(harness.getCreateCount(), 1);
  assert.equal(harness.getState().finance.length, 1);
  assert.equal(harness.getState().audit.length, 1);
});

test("replay returns the persisted result before mutable plan or client validation", async () => {
  const harness = createHarness();
  let mutablePlan = { active: true, priceCents: 5000, name: "Sesión original" };
  const validateMutableState = () => {
    if (!mutablePlan.active || mutablePlan.priceCents !== 5000 || mutablePlan.name !== "Sesión original") {
      throw new Error("MUTABLE_STATE_CHANGED");
    }
  };
  const first = await harness.execute({
    branchId: "branch-a",
    operationKey: "operation-mutable-replay",
    payload: basePayload,
    validateMutableState,
  });
  const before = cloneState(harness.getState());

  mutablePlan = { active: false, priceCents: 7500, name: "Sesión renombrada" };
  const replay = await harness.execute({
    branchId: "branch-a",
    operationKey: "operation-mutable-replay",
    payload: basePayload,
    validateMutableState,
  });

  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.result, first.result);
  assert.deepEqual(harness.getState(), before);
  assert.equal(harness.getCreateCount(), 1);
});

test("same key and different payload rejects without changing persisted state", async () => {
  const harness = createHarness();
  await harness.execute({ branchId: "branch-a", operationKey: "operation-conflict", payload: basePayload });
  const before = cloneState(harness.getState());

  await assert.rejects(
    harness.execute({
      branchId: "branch-a",
      operationKey: "operation-conflict",
      payload: { ...basePayload, note: "Otra nota" },
    }),
    (error: unknown) => error instanceof QuickChargeIdempotencyError
      && error.code === QUICK_CHARGE_OPERATION_KEY_CONFLICT,
  );
  assert.deepEqual(harness.getState(), before);
});

test("legacy operation keys without fingerprint are rejected conservatively", async () => {
  const scope = "branch-a:service_sale:legacy-key";
  const harness = createHarness({
    operations: new Map([[scope, {
      fingerprint: null,
      result: { financeEntryId: "legacy-finance", clientUserId: "legacy-user", membershipId: "legacy-membership" },
    }]]),
  });

  await assert.rejects(
    harness.execute({ branchId: "branch-a", operationKey: "legacy-key", payload: basePayload }),
    (error: unknown) => error instanceof QuickChargeIdempotencyError
      && error.code === QUICK_CHARGE_LEGACY_OPERATION_KEY_CONFLICT,
  );
  assert.equal(harness.getCreateCount(), 0);
});

test("a soft-deleted service_sale reserves its historical operation key", async () => {
  const scope = "branch-a:service_sale:deleted-key";
  const fingerprint = createQuickChargePayloadFingerprint(basePayload);
  const harness = createHarness({
    finance: ["deleted-finance"],
    operations: new Map([[scope, {
      fingerprint,
      deletedAt: "2026-08-30T12:00:00.000Z",
      result: { financeEntryId: "deleted-finance", clientUserId: "deleted-user", membershipId: "deleted-membership" },
    }]]),
  });
  const before = cloneState(harness.getState());

  await assert.rejects(
    harness.execute({ branchId: "branch-a", operationKey: "deleted-key", payload: basePayload }),
    (error: unknown) => error instanceof QuickChargeIdempotencyError
      && error.code === QUICK_CHARGE_LEGACY_OPERATION_KEY_CONFLICT,
  );
  assert.deepEqual(harness.getState(), before);
  assert.equal(harness.getCreateCount(), 0);
});

for (const missingReplayPart of ["metadata", "membership", "crm", "audit"] as const) {
  test(`an incomplete replay missing ${missingReplayPart} fails closed without repairs`, async () => {
    const operationKey = `incomplete-${missingReplayPart}`;
    const scope = `branch-a:service_sale:${operationKey}`;
    const harness = createHarness({
      operations: new Map([[scope, {
        fingerprint: createQuickChargePayloadFingerprint(basePayload),
        missingReplayPart,
        result: { financeEntryId: "finance-existing", clientUserId: "user-existing", membershipId: "membership-existing" },
      }]]),
    });
    const before = cloneState(harness.getState());

    await assert.rejects(
      harness.execute({ branchId: "branch-a", operationKey, payload: basePayload }),
      (error: unknown) => error instanceof QuickChargeIdempotencyError
        && error.code === QUICK_CHARGE_INCOMPLETE_REPLAY_CONFLICT,
    );
    assert.deepEqual(harness.getState(), before);
    assert.equal(harness.getCreateCount(), 0);
  });
}

test("two concurrent requests with the same key persist exactly one operation", async () => {
  const harness = createHarness();
  const [first, second] = await Promise.all([
    harness.execute({ branchId: "branch-a", operationKey: "operation-concurrent", payload: basePayload }),
    harness.execute({ branchId: "branch-a", operationKey: "operation-concurrent", payload: basePayload }),
  ]);

  assert.equal([first.replayed, second.replayed].filter(Boolean).length, 1);
  assert.equal(harness.getCreateCount(), 1);
  assert.equal(harness.getLockCount(), 2);
  assert.equal(harness.getState().finance.length, 1);
  assert.equal(harness.getState().audit.length, 1);
});

test("concurrent equivalent phone formats share one client identity under distinct operation keys", async () => {
  const harness = createPhoneConcurrencyHarness();
  const [first, second] = await Promise.all([
    harness.execute({ branchId: "branch-a", operationKey: "phone-operation-a", phone: "55 1234 5678" }),
    harness.execute({ branchId: "branch-a", operationKey: "phone-operation-b", phone: "5512345678" }),
  ]);
  const state = harness.getState();

  assert.equal(normalizeQuickChargePhone("55 1234 5678"), normalizeQuickChargePhone("5512345678"));
  assert.equal(getQuickChargePhoneLockToken("55 1234 5678"), getQuickChargePhoneLockToken("5512345678"));
  assert.equal(first.result.clientUserId, second.result.clientUserId);
  assert.equal(state.usersByPhone.size, 1);
  assert.equal(state.memberships.length, 1);
  assert.equal(state.crm.length, 1);
  assert.equal(state.operations.size, 2);
  assert.equal(state.finance.length, 2);
  assert.equal(state.audit.length, 2);
  assert.deepEqual(state.lockOrder.get("phone-operation-a"), ["operation", "phone"]);
  assert.deepEqual(state.lockOrder.get("phone-operation-b"), ["operation", "phone"]);
});

for (const failureStage of ["after_client", "after_membership_crm", "before_finance", "after_finance"] as const) {
  test(`transaction rolls back every write on failure ${failureStage}`, async () => {
    const harness = createHarness();
    await assert.rejects(
      harness.execute({
        branchId: "branch-a",
        operationKey: `operation-${failureStage}`,
        payload: basePayload,
        failAt: failureStage,
      }),
    );

    assert.deepEqual(harness.getState().users, []);
    assert.deepEqual(harness.getState().memberships, []);
    assert.deepEqual(harness.getState().crm, []);
    assert.deepEqual(harness.getState().finance, []);
    assert.deepEqual(harness.getState().audit, []);
    assert.equal(harness.getState().operations.size, 0);
  });
}

test("the same operation key is isolated by branch and never replays cross-tenant data", async () => {
  const harness = createHarness();
  const branchA = await harness.execute({ branchId: "branch-a", operationKey: "shared-operation", payload: basePayload });
  const branchB = await harness.execute({ branchId: "branch-b", operationKey: "shared-operation", payload: basePayload });

  assert.equal(branchA.replayed, false);
  assert.equal(branchB.replayed, false);
  assert.notEqual(branchA.result.financeEntryId, branchB.result.financeEntryId);
  assert.equal(harness.getState().finance.length, 2);
});

test("service_sale remains protected and tax-added money is rounded in integer cents", () => {
  assert.equal(isProtectedFinanceSource("service_sale"), true);
  const snapshot = computeMembershipPlanChargeSnapshot({ priceCents: 250000, taxMode: "tax_added", taxRate: 16 });
  assert.equal(snapshot.subtotalBeforeTaxCents, 250000);
  assert.equal(snapshot.taxTotalCents, 40000);
  assert.equal(snapshot.finalTotalCents, 290000);
});

test("frontend operation state blocks double submit and reuses the key after an error", () => {
  let keyCounter = 0;
  const createKey = () => `key-${++keyCounter}`;
  let state: OperationAttemptState | null = null;

  const first = beginStableOperationAttempt(state, "payload-a", createKey);
  state = first.state;
  assert.equal(first.attempt.allowed, true);
  assert.equal(first.attempt.key, "key-1");

  const doubleClick = beginStableOperationAttempt(state, "payload-a", createKey);
  assert.equal(doubleClick.attempt.allowed, false);
  assert.equal(doubleClick.attempt.key, "key-1");

  state = markStableOperationError(state, "payload-a");
  const retry = beginStableOperationAttempt(state, "payload-a", createKey);
  state = retry.state;
  assert.equal(retry.attempt.allowed, true);
  assert.equal(retry.attempt.key, "key-1");

  state = markStableOperationError(state, "payload-a");
  const changedPayload = beginStableOperationAttempt(state, "payload-b", createKey);
  state = changedPayload.state;
  assert.equal(changedPayload.attempt.key, "key-2");

  state = markStableOperationSuccess(state, "payload-b");
  assert.equal(state, null);
});
