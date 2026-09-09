import assert from "node:assert/strict";
import test from "node:test";
import {
  commitLockedMembershipPlanRemoval,
  MembershipPlanRemovalError,
  MEMBERSHIP_PLAN_REMOVAL_FORBIDDEN,
  MEMBERSHIP_PLAN_REMOVAL_LEASE_BLOCKED,
  MEMBERSHIP_PLAN_REMOVAL_NOT_FOUND,
  MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT,
  type MembershipPlanRemovalAudit,
  type MembershipPlanRemovalRecord,
} from "../server/membership-plan-removal";

type FakeMembership = MembershipPlanRemovalRecord;

type FakeBooking = {
  id: string;
  branchId: string;
  userId: string;
  bookingDate: string;
  startTime: string;
  status: "confirmed" | "attended" | "no_show" | "cancelled";
  classConsumed: boolean | null;
};

type FakeState = {
  memberships: Map<string, FakeMembership>;
  plans: Map<string, { id: string; branchId: string; name: string }>;
  openLeaseMembershipIds: Set<string>;
  clients: Array<{ id: string; email: string; authProvider: string }>;
  bookings: FakeBooking[];
  attendances: Array<{ id: string; bookingId: string; branchId: string; userId: string }>;
  crm: Array<{ id: string; branchId: string; userId: string; tags: string }>;
  financeEntries: Array<{ id: string; membershipId: string; amount: number }>;
  chargeEvents: Array<{ id: string; membershipId: string; finalTotalCents: number }>;
  purchases: Array<{ id: string; clientUserId: string }>;
  notifications: Array<{ id: string; branchId: string; recipientUserId: string }>;
  audits: MembershipPlanRemovalAudit[];
};

type FailureStage = "after_membership" | "during_booking_cancellation" | "before_audit";

const branchId = "branch-1";
const membershipId = "membership-1";
const clientUserId = "client-1";
const planId = "plan-1";
const today = "2026-09-07";

function createMembership(overrides: Partial<FakeMembership> = {}): FakeMembership {
  return {
    id: membershipId,
    branchId,
    userId: clientUserId,
    status: "active",
    clientStatus: "active",
    planId,
    planNameSnapshot: null,
    classesRemaining: 8,
    classesTotal: 8,
    expiresAt: "2026-10-07T06:00:00.000Z",
    membershipStartDate: "2026-09-07T06:00:00.000Z",
    membershipEndDate: "2026-10-07T06:00:00.000Z",
    paidAt: "2026-09-07T15:00:00.000Z",
    renewedFromId: "membership-prior",
    ...overrides,
  };
}

function createInitialState(membership = createMembership()): FakeState {
  return {
    memberships: new Map([[membership.id, membership]]),
    plans: new Map([[planId, { id: planId, branchId, name: "Plan mensual" }]]),
    openLeaseMembershipIds: new Set(),
    clients: [{ id: clientUserId, email: "cliente@example.test", authProvider: "email" }],
    bookings: [
      { id: "future-legacy", branchId, userId: clientUserId, bookingDate: "2026-09-08", startTime: "09:00", status: "confirmed", classConsumed: null },
      { id: "future-modern", branchId, userId: clientUserId, bookingDate: "2026-09-08", startTime: "09:00", status: "confirmed", classConsumed: false },
      { id: "past-legacy", branchId, userId: clientUserId, bookingDate: "2026-09-06", startTime: "09:00", status: "confirmed", classConsumed: null },
      { id: "started-today", branchId, userId: clientUserId, bookingDate: today, startTime: "08:00", status: "confirmed", classConsumed: null },
      { id: "attended", branchId, userId: clientUserId, bookingDate: "2026-09-06", startTime: "09:00", status: "attended", classConsumed: true },
      { id: "other-user", branchId, userId: "client-2", bookingDate: "2026-09-08", startTime: "09:00", status: "confirmed", classConsumed: null },
      { id: "other-branch", branchId: "branch-2", userId: clientUserId, bookingDate: "2026-09-08", startTime: "09:00", status: "confirmed", classConsumed: null },
    ],
    attendances: [{ id: "attendance-1", bookingId: "attended", branchId, userId: clientUserId }],
    crm: [{ id: "crm-1", branchId, userId: clientUserId, tags: "cliente frecuente" }],
    financeEntries: [{ id: "finance-1", membershipId, amount: 1160 }],
    chargeEvents: [{ id: "charge-1", membershipId, finalTotalCents: 116000 }],
    purchases: [{ id: "purchase-1", clientUserId }],
    notifications: [{ id: "notification-1", branchId, recipientUserId: clientUserId }],
    audits: [],
  };
}

function cloneState(state: FakeState): FakeState {
  return {
    memberships: new Map([...state.memberships].map(([key, value]) => [key, { ...value }])),
    plans: new Map([...state.plans].map(([key, value]) => [key, { ...value }])),
    openLeaseMembershipIds: new Set(state.openLeaseMembershipIds),
    clients: state.clients.map((row) => ({ ...row })),
    bookings: state.bookings.map((row) => ({ ...row })),
    attendances: state.attendances.map((row) => ({ ...row })),
    crm: state.crm.map((row) => ({ ...row })),
    financeEntries: state.financeEntries.map((row) => ({ ...row })),
    chargeEvents: state.chargeEvents.map((row) => ({ ...row })),
    purchases: state.purchases.map((row) => ({ ...row })),
    notifications: state.notifications.map((row) => ({ ...row })),
    audits: state.audits.map((row) => ({
      ...row,
      before: { ...row.before },
      after: { ...row.after },
    })),
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

function createHarness(initialState = createInitialState()) {
  let state = cloneState(initialState);
  const acquireTransaction = createMutex();

  async function execute(params: {
    requestBranchId?: string;
    requestMembershipId?: string;
    actorUserId?: string;
    actorRole?: string;
    actorScopeValid?: boolean;
    failAt?: FailureStage;
  } = {}) {
    const requestBranchId = params.requestBranchId ?? branchId;
    const requestMembershipId = params.requestMembershipId ?? membershipId;

    return commitLockedMembershipPlanRemoval({
      branchId: requestBranchId,
      membershipId: requestMembershipId,
      actorUserId: params.actorUserId ?? "branch-admin-1",
      actorRole: params.actorRole ?? "BRANCH_ADMIN",
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
      validateActorScope: async () => params.actorScopeValid !== false,
      lockMembership: async (draft, id, scopedBranchId) => {
        const membership = draft.memberships.get(id);
        return membership?.branchId === scopedBranchId ? membership : undefined;
      },
      loadPlan: async (draft, id) => draft.plans.get(id),
      hasOpenLeaseContract: async (draft, id) => draft.openLeaseMembershipIds.has(id),
      removePlan: async (draft, membership) => {
        const updated: FakeMembership = {
          ...membership,
          planId: null,
          classesRemaining: null,
          classesTotal: null,
          expiresAt: null,
          membershipStartDate: null,
          membershipEndDate: null,
          paidAt: null,
          renewedFromId: null,
        };
        draft.memberships.set(membership.id, updated);
        if (params.failAt === "after_membership") throw new Error("FAIL_AFTER_MEMBERSHIP");
        return updated;
      },
      cancelApplicableFutureBookings: async (draft, membership) => {
        let cancelled = 0;
        for (const booking of draft.bookings) {
          if (
            booking.userId === membership.userId
            && booking.branchId === requestBranchId
            && booking.status === "confirmed"
            && booking.classConsumed === null
            && booking.bookingDate >= today
            && (booking.bookingDate > today || booking.startTime > "12:00")
          ) {
            booking.status = "cancelled";
            cancelled += 1;
            if (params.failAt === "during_booking_cancellation") {
              throw new Error("FAIL_DURING_BOOKING_CANCELLATION");
            }
          }
        }
        return cancelled;
      },
      createAudit: async (draft, audit) => {
        if (params.failAt === "before_audit") throw new Error("FAIL_BEFORE_AUDIT");
        draft.audits.push(audit);
      },
    });
  }

  return {
    execute,
    getState: () => state,
    addBooking: (booking: FakeBooking) => state.bookings.push(booking),
  };
}

async function assertRemovalError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof MembershipPlanRemovalError);
    assert.equal(error.code, code);
    return true;
  });
}

test("1. removes an active plan and clears only its operational membership fields", async () => {
  const harness = createHarness();
  const result = await harness.execute();
  const membership = harness.getState().memberships.get(membershipId)!;

  assert.equal(result.idempotentReplay, false);
  assert.equal(membership.planId, null);
  assert.equal(membership.classesRemaining, null);
  assert.equal(membership.classesTotal, null);
  assert.equal(membership.expiresAt, null);
  assert.equal(membership.membershipStartDate, null);
  assert.equal(membership.membershipEndDate, null);
  assert.equal(membership.paidAt, null);
  assert.equal(membership.renewedFromId, null);
  assert.equal(membership.status, "active");
  assert.equal(membership.clientStatus, "active");
});

test("2. keeps the client record", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState()).clients;
  await harness.execute();
  assert.deepEqual(harness.getState().clients, before);
});

test("3. keeps Caja entries unchanged", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState()).financeEntries;
  await harness.execute();
  assert.deepEqual(harness.getState().financeEntries, before);
});

test("4. keeps charge events unchanged", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState()).chargeEvents;
  await harness.execute();
  assert.deepEqual(harness.getState().chargeEvents, before);
});

test("5. preserves past bookings, attendance and purchase history", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState());
  await harness.execute();

  assert.deepEqual(harness.getState().attendances, before.attendances);
  assert.deepEqual(harness.getState().purchases, before.purchases);
  assert.deepEqual(
    harness.getState().bookings.find((booking) => booking.id === "past-legacy"),
    before.bookings.find((booking) => booking.id === "past-legacy"),
  );
});

test("6. cancels only an applicable future legacy confirmed booking", async () => {
  const harness = createHarness();
  const result = await harness.execute();
  assert.equal(result.cancelledBookings, 1);
  assert.equal(harness.getState().bookings.find((booking) => booking.id === "future-legacy")?.status, "cancelled");
});

test("7. does not change past bookings", async () => {
  const harness = createHarness();
  await harness.execute();
  assert.equal(harness.getState().bookings.find((booking) => booking.id === "past-legacy")?.status, "confirmed");
  assert.equal(harness.getState().bookings.find((booking) => booking.id === "started-today")?.status, "confirmed");
  assert.equal(harness.getState().bookings.find((booking) => booking.id === "attended")?.status, "attended");
});

test("8. does not change modern, other-user or other-branch bookings", async () => {
  const harness = createHarness();
  await harness.execute();
  for (const id of ["future-modern", "other-user", "other-branch"]) {
    assert.equal(harness.getState().bookings.find((booking) => booking.id === id)?.status, "confirmed");
  }
});

test("9. rejects a membership from another branch without effects", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState());
  await assertRemovalError(harness.execute({ requestBranchId: "branch-2" }), MEMBERSHIP_PLAN_REMOVAL_NOT_FOUND);
  assert.deepEqual(harness.getState(), before);
});

test("10. rolls back when an error occurs after changing the membership", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState());
  await assert.rejects(harness.execute({ failAt: "after_membership" }), /FAIL_AFTER_MEMBERSHIP/);
  assert.deepEqual(harness.getState(), before);
});

test("11. rolls back membership and bookings when cancellation fails", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState());
  await assert.rejects(harness.execute({ failAt: "during_booking_cancellation" }), /FAIL_DURING_BOOKING_CANCELLATION/);
  assert.deepEqual(harness.getState(), before);
});

test("12. rolls back all changes when audit creation fails", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState());
  await assert.rejects(harness.execute({ failAt: "before_audit" }), /FAIL_BEFORE_AUDIT/);
  assert.deepEqual(harness.getState(), before);
});

test("13. writes one complete audit record", async () => {
  const harness = createHarness();
  await harness.execute();
  const [audit] = harness.getState().audits;

  assert.equal(harness.getState().audits.length, 1);
  assert.equal(audit.actorUserId, "branch-admin-1");
  assert.equal(audit.branchId, branchId);
  assert.equal(audit.clientUserId, clientUserId);
  assert.equal(audit.membershipId, membershipId);
  assert.equal(audit.previousPlanId, planId);
  assert.equal(audit.previousPlanName, "Plan mensual");
  assert.equal(audit.before.planId, planId);
  assert.equal(audit.after.planId, null);
  assert.equal(audit.cancelledBookings, 1);
});

test("14. serializes concurrent requests into one transition", async () => {
  const harness = createHarness();
  const results = await Promise.all([harness.execute(), harness.execute()]);

  assert.equal(results.filter((result) => !result.idempotentReplay).length, 1);
  assert.equal(results.filter((result) => result.idempotentReplay).length, 1);
  assert.equal(harness.getState().audits.length, 1);
  assert.equal(harness.getState().bookings.find((booking) => booking.id === "future-legacy")?.status, "cancelled");
});

test("15. retry is a no-op and does not cancel or audit again", async () => {
  const harness = createHarness();
  await harness.execute();
  harness.addBooking({
    id: "created-after-removal",
    branchId,
    userId: clientUserId,
    bookingDate: "2026-09-09",
    startTime: "09:00",
    status: "confirmed",
    classConsumed: null,
  });

  const replay = await harness.execute();
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.cancelledBookings, 0);
  assert.equal(harness.getState().audits.length, 1);
  assert.equal(harness.getState().bookings.find((booking) => booking.id === "created-after-removal")?.status, "confirmed");
});

test("16. an already removed coherent membership returns deterministically", async () => {
  const removedMembership = createMembership({
    planId: null,
    classesRemaining: null,
    classesTotal: null,
    expiresAt: null,
    membershipStartDate: null,
    membershipEndDate: null,
    paidAt: null,
    renewedFromId: null,
  });
  const harness = createHarness(createInitialState(removedMembership));
  const result = await harness.execute();

  assert.equal(result.idempotentReplay, true);
  assert.equal(result.cancelledBookings, 0);
  assert.equal(harness.getState().audits.length, 0);
});

test("17. keeps app and Google identity fields unchanged", async () => {
  const initial = createInitialState();
  initial.clients[0] = { id: clientUserId, email: "google@example.test", authProvider: "google" };
  const harness = createHarness(initial);
  const before = cloneState(harness.getState()).clients;
  await harness.execute();
  assert.deepEqual(harness.getState().clients, before);
});

test("18. keeps CRM and notifications unchanged", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState());
  await harness.execute();
  assert.deepEqual(harness.getState().crm, before.crm);
  assert.deepEqual(harness.getState().notifications, before.notifications);
});

test("legacy membership without plan but with residual operational fields fails closed", async () => {
  const harness = createHarness(createInitialState(createMembership({ planId: null })));
  const before = cloneState(harness.getState());
  await assertRemovalError(harness.execute(), MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT);
  assert.deepEqual(harness.getState(), before);
});

test("left or banned membership with a linked plan fails closed", async () => {
  for (const status of ["left", "banned"] as const) {
    const harness = createHarness(createInitialState(createMembership({ status, clientStatus: "inactive" })));
    await assertRemovalError(harness.execute(), MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT);
    assert.equal(harness.getState().memberships.get(membershipId)?.planId, planId);
  }
});

test("open lease contract blocks plan removal without changing data", async () => {
  const initial = createInitialState();
  initial.openLeaseMembershipIds.add(membershipId);
  const harness = createHarness(initial);
  const before = cloneState(harness.getState());
  await assertRemovalError(harness.execute(), MEMBERSHIP_PLAN_REMOVAL_LEASE_BLOCKED);
  assert.deepEqual(harness.getState(), before);
});

test("missing or cross-tenant plan reference fails closed", async () => {
  for (const plan of [undefined, { id: planId, branchId: "branch-2", name: "Plan ajeno" }]) {
    const initial = createInitialState();
    if (plan) initial.plans.set(planId, plan);
    else initial.plans.delete(planId);
    const harness = createHarness(initial);
    await assertRemovalError(harness.execute(), MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT);
    assert.equal(harness.getState().memberships.get(membershipId)?.planId, planId);
  }
});

test("stale or unauthorized actor scope is rejected before any mutation", async () => {
  const harness = createHarness();
  const before = cloneState(harness.getState());

  await assertRemovalError(
    harness.execute({ actorScopeValid: false }),
    MEMBERSHIP_PLAN_REMOVAL_FORBIDDEN,
  );

  assert.deepEqual(harness.getState(), before);
});
