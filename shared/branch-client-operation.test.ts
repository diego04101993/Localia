import assert from "node:assert/strict";
import test from "node:test";
import {
  BRANCH_CLIENT_DUPLICATE,
  BRANCH_CLIENT_IDENTITY_MANAGED_BY_APP,
  BRANCH_CLIENT_NOT_FOUND,
  BRANCH_CLIENT_SHARED_IDENTITY,
  BranchClientOperationError,
  commitBranchClientEdit,
  commitBranchClientSoftDelete,
  normalizeBranchClientPhone,
} from "../server/branch-client-operation";

type User = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  lastName: string | null;
  authProvider: string;
  firebaseUid: string | null;
  acceptedTerms: boolean;
};

type Membership = {
  id: string;
  branchId: string;
  userId: string;
  status: string;
  clientStatus: string;
  source: string;
};

type State = {
  users: Map<string, User>;
  memberships: Map<string, Membership>;
  crm: Map<string, Record<string, unknown>>;
  audits: Array<Record<string, any>>;
  activeBranchCount: number;
};

function cloneState(state: State): State {
  return {
    users: new Map([...state.users].map(([id, user]) => [id, { ...user }])),
    memberships: new Map([...state.memberships].map(([id, membership]) => [id, { ...membership }])),
    crm: new Map([...state.crm].map(([key, value]) => [key, { ...value }])),
    audits: state.audits.map((audit) => ({ ...audit, metadata: { ...audit.metadata } })),
    activeBranchCount: state.activeBranchCount,
  };
}

function createState(overrides: { user?: Partial<User>; membership?: Partial<Membership>; activeBranchCount?: number } = {}): State {
  const user: User = {
    id: "client-1",
    email: "client@example.test",
    phone: "9981112233",
    name: "Cliente",
    lastName: "Prueba",
    authProvider: "email",
    firebaseUid: null,
    acceptedTerms: false,
    ...overrides.user,
  };
  const membership: Membership = {
    id: "membership-1",
    branchId: "branch-1",
    userId: user.id,
    status: "active",
    clientStatus: "active",
    source: "admin_created",
    ...overrides.membership,
  };
  return {
    users: new Map([[user.id, user]]),
    memberships: new Map([[membership.id, membership]]),
    crm: new Map(),
    audits: [],
    activeBranchCount: overrides.activeBranchCount ?? 1,
  };
}

function createHarness(initial = createState(), failAudit = false) {
  let state = cloneState(initial);
  const transaction = async <T>(work: (draft: State) => Promise<T>) => {
    const draft = cloneState(state);
    const result = await work(draft);
    state = draft;
    return result;
  };

  const lockMembership = async (draft: State, branchId: string, clientId: string) => (
    [...draft.memberships.values()].find((row) => row.branchId === branchId && row.userId === clientId)
  );
  const createAudit = async (draft: State, audit: Record<string, any>) => {
    if (failAudit) throw new Error("AUDIT_FAILED");
    draft.audits.push(audit);
  };

  return {
    edit: (
      globalPatch: Record<string, any>,
      privatePatch: Record<string, any>,
      branchId = "branch-1",
      crmPatch: Record<string, any> = {},
    ) => (
      commitBranchClientEdit({
        actorUserId: "admin-1",
        branchId,
        clientId: "client-1",
        globalPatch,
        privatePatch,
        crmPatch,
        transaction,
        lockMembership,
        lockUser: async (draft, clientId) => draft.users.get(clientId),
        countOperationalBranches: async (draft) => draft.activeBranchCount,
        findUserByEmail: async (draft, email) => (
          [...draft.users.values()].find((user) => user.email?.trim().toLowerCase() === email)
        ),
        findPhoneMatches: async (draft, scopedBranchId, phone, excludedClientId) => (
          [...draft.memberships.values()]
            .filter((membership) => membership.branchId === scopedBranchId && membership.userId !== excludedClientId)
            .map((membership) => draft.users.get(membership.userId)!)
            .filter((user) => normalizeBranchClientPhone(user.phone) === phone)
            .map((user) => ({ userId: user.id, name: user.name, phone: user.phone }))
        ),
        updateUser: async (draft, clientId, patch) => {
          const current = draft.users.get(clientId);
          if (!current) return undefined;
          const updated = { ...current, ...patch } as User;
          draft.users.set(clientId, updated);
          return updated;
        },
        upsertBranchProfile: async (draft, scopedBranchId, clientId, patch, _membership, initializePrivateProfile) => {
          const key = `${scopedBranchId}:${clientId}`;
          const updated = {
            ...(draft.crm.get(key) ?? {}),
            ...patch,
            ...(initializePrivateProfile ? { privateProfileInitialized: true } : {}),
          };
          draft.crm.set(key, updated);
          return updated;
        },
        createAudit,
      })
    ),
    softDelete: (branchId = "branch-1") => commitBranchClientSoftDelete({
      actorUserId: "admin-1",
      branchId,
      clientId: "client-1",
      transaction,
      lockMembership,
      updateMembership: async (draft, membershipId, patch) => {
        const membership = draft.memberships.get(membershipId);
        if (!membership) return undefined;
        const updated = { ...membership, ...patch } as Membership;
        draft.memberships.set(membershipId, updated);
        return updated;
      },
      createAudit,
    }),
    getState: () => state,
  };
}

async function assertOperationError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof BranchClientOperationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("client edit updates global identity, branch-private CRM and audit atomically", async () => {
  const harness = createHarness();
  await harness.edit(
    { name: "Nuevo", email: " NEW@Example.Test " },
    { medicalNotes: "Nota privada" },
    "branch-1",
    { clientStatus: "vip", tags: "prioridad" },
  );

  assert.equal(harness.getState().users.get("client-1")?.name, "Nuevo");
  assert.equal(harness.getState().users.get("client-1")?.email, "new@example.test");
  assert.equal(harness.getState().crm.get("branch-1:client-1")?.medicalNotes, "Nota privada");
  assert.equal(harness.getState().crm.get("branch-1:client-1")?.clientStatus, "vip");
  assert.equal(harness.getState().crm.get("branch-1:client-1")?.tags, "prioridad");
  assert.equal(harness.getState().audits.length, 1);
  assert.deepEqual(harness.getState().audits[0].metadata.globalFields.sort(), ["email", "name"]);
});

test("client edit rolls back user and CRM when audit creation fails", async () => {
  const harness = createHarness(createState(), true);
  await assert.rejects(
    harness.edit({ name: "No debe persistir" }, { medicalNotes: "Tampoco" }),
    /AUDIT_FAILED/,
  );
  assert.equal(harness.getState().users.get("client-1")?.name, "Cliente");
  assert.equal(harness.getState().crm.size, 0);
});

test("cross-branch edit is rejected without mutations", async () => {
  const harness = createHarness();
  await assertOperationError(harness.edit({ name: "Ajeno" }, {}, "branch-2"), BRANCH_CLIENT_NOT_FOUND);
  assert.equal(harness.getState().users.get("client-1")?.name, "Cliente");
});

test("shared operational identity blocks global edits", async () => {
  const harness = createHarness(createState({ activeBranchCount: 2 }));
  await assertOperationError(harness.edit({ name: "No permitido" }, {}), BRANCH_CLIENT_SHARED_IDENTITY);
  assert.equal(harness.getState().users.get("client-1")?.name, "Cliente");
});

test("shared operational identity also blocks branch-managed avatar changes", async () => {
  const harness = createHarness(createState({ activeBranchCount: 2 }));
  await assertOperationError(
    harness.edit({ avatarUrl: "/uploads/new-avatar.webp" }, {}),
    BRANCH_CLIENT_SHARED_IDENTITY,
  );
});

test("shared operational identity still allows branch-private CRM edits", async () => {
  const harness = createHarness(createState({ activeBranchCount: 2 }));
  await harness.edit({}, { injuriesNotes: "Solo sucursal" });
  assert.equal(harness.getState().crm.get("branch-1:client-1")?.injuriesNotes, "Solo sucursal");
  assert.equal(harness.getState().users.get("client-1")?.name, "Cliente");
});

test("CRM-only updates do not claim that the private profile was initialized", async () => {
  const harness = createHarness();
  await harness.edit({}, {}, "branch-1", { tags: "seguimiento" });
  const crm = harness.getState().crm.get("branch-1:client-1");
  assert.equal(crm?.tags, "seguimiento");
  assert.equal(Object.hasOwn(crm ?? {}, "privateProfileInitialized"), false);
});

test("app-managed identity rejects global edits", async () => {
  const harness = createHarness(createState({
    user: { acceptedTerms: true, firebaseUid: "firebase-1" },
    membership: { source: "self_join" },
  }));
  await assertOperationError(
    harness.edit({ phone: "9980000000" }, {}),
    BRANCH_CLIENT_IDENTITY_MANAGED_BY_APP,
  );
});

test("duplicate email is rejected before any write", async () => {
  const initial = createState();
  initial.users.set("client-2", {
    ...initial.users.get("client-1")!,
    id: "client-2",
    email: "taken@example.test",
  });
  const harness = createHarness(initial);
  await assertOperationError(harness.edit({ email: "TAKEN@example.test" }, {}), BRANCH_CLIENT_DUPLICATE);
  assert.equal(harness.getState().users.get("client-1")?.email, "client@example.test");
});

test("duplicate normalized phone in the same branch is rejected", async () => {
  const initial = createState();
  initial.users.set("client-2", {
    ...initial.users.get("client-1")!,
    id: "client-2",
    email: "other@example.test",
    phone: "+52 998 222 3344",
  });
  initial.memberships.set("membership-2", {
    ...initial.memberships.get("membership-1")!,
    id: "membership-2",
    userId: "client-2",
  });
  const harness = createHarness(initial);
  await assertOperationError(harness.edit({ phone: "998-222-3344" }, {}), BRANCH_CLIENT_DUPLICATE);
  assert.equal(harness.getState().users.get("client-1")?.phone, "9981112233");
});

test("soft delete changes only the scoped membership and writes audit", async () => {
  const initial = createState();
  initial.crm.set("branch-1:client-1", { tags: "preserve" });
  const harness = createHarness(initial);
  await harness.softDelete();

  assert.equal(harness.getState().memberships.get("membership-1")?.status, "left");
  assert.equal(harness.getState().memberships.get("membership-1")?.clientStatus, "inactive");
  assert.equal(harness.getState().users.has("client-1"), true);
  assert.equal(harness.getState().crm.get("branch-1:client-1")?.tags, "preserve");
  assert.equal(harness.getState().audits[0].action, "SOFT_DELETE_CLIENT");
});

test("soft delete rolls back membership when audit creation fails", async () => {
  const harness = createHarness(createState(), true);
  await assert.rejects(harness.softDelete(), /AUDIT_FAILED/);
  assert.equal(harness.getState().memberships.get("membership-1")?.status, "active");
});

test("cross-branch soft delete cannot affect another branch", async () => {
  const harness = createHarness();
  await assertOperationError(harness.softDelete("branch-2"), BRANCH_CLIENT_NOT_FOUND);
  assert.equal(harness.getState().memberships.get("membership-1")?.status, "active");
});
