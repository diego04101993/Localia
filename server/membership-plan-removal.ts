import { isMembershipOperational } from "./membership-state";

export const MEMBERSHIP_PLAN_REMOVAL_NOT_FOUND = "MEMBERSHIP_NOT_FOUND";
export const MEMBERSHIP_PLAN_REMOVAL_FORBIDDEN = "MEMBERSHIP_PLAN_REMOVAL_FORBIDDEN";
export const MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT = "MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT";
export const MEMBERSHIP_PLAN_REMOVAL_BUSY = "MEMBERSHIP_PLAN_REMOVAL_BUSY";
export const MEMBERSHIP_PLAN_REMOVAL_LEASE_BLOCKED = "LEASE_CONTRACT_OPEN_REMOVE_BLOCKED";

export type MembershipPlanRemovalRecord = {
  id: string;
  branchId: string;
  userId: string;
  status: string;
  clientStatus: string;
  planId: string | null;
  planNameSnapshot: string | null;
  classesRemaining: number | null;
  classesTotal: number | null;
  expiresAt: Date | string | null;
  membershipStartDate: Date | string | null;
  membershipEndDate: Date | string | null;
  paidAt: Date | string | null;
  renewedFromId: string | null;
};

export type MembershipPlanRemovalPlan = {
  id: string;
  branchId: string;
  name: string;
};

export type MembershipPlanRemovalSnapshot = {
  status: string;
  clientStatus: string;
  planId: string | null;
  planNameSnapshot: string | null;
  classesRemaining: number | null;
  classesTotal: number | null;
  expiresAt: Date | string | null;
  membershipStartDate: Date | string | null;
  membershipEndDate: Date | string | null;
  paidAt: Date | string | null;
  renewedFromId: string | null;
};

export type MembershipPlanRemovalAudit = {
  actorUserId: string;
  branchId: string;
  clientUserId: string;
  membershipId: string;
  previousPlanId: string;
  previousPlanName: string;
  before: MembershipPlanRemovalSnapshot;
  after: MembershipPlanRemovalSnapshot;
  cancelledBookings: number;
};

export type MembershipPlanRemovalOperationResult<TMembership extends MembershipPlanRemovalRecord> = {
  membership: TMembership;
  cancelledBookings: number;
  idempotentReplay: boolean;
};

export class MembershipPlanRemovalError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "MembershipPlanRemovalError";
  }
}

type MembershipPlanRemovalDisposition = "removable" | "already_removed" | "incompatible";

const operationalPlanFields: Array<keyof Pick<
  MembershipPlanRemovalRecord,
  | "classesRemaining"
  | "classesTotal"
  | "expiresAt"
  | "membershipStartDate"
  | "membershipEndDate"
  | "paidAt"
  | "renewedFromId"
>> = [
  "classesRemaining",
  "classesTotal",
  "expiresAt",
  "membershipStartDate",
  "membershipEndDate",
  "paidAt",
  "renewedFromId",
];

export function getMembershipPlanRemovalDisposition(
  membership: MembershipPlanRemovalRecord,
): MembershipPlanRemovalDisposition {
  if (membership.planId === null) {
    return operationalPlanFields.some((field) => membership[field] !== null)
      ? "incompatible"
      : "already_removed";
  }

  if (!membership.planId.trim()) return "incompatible";

  return isMembershipOperational(membership.status, membership.clientStatus)
    ? "removable"
    : "incompatible";
}

export function buildMembershipPlanRemovalSnapshot(
  membership: MembershipPlanRemovalRecord,
): MembershipPlanRemovalSnapshot {
  return {
    status: membership.status,
    clientStatus: membership.clientStatus,
    planId: membership.planId,
    planNameSnapshot: membership.planNameSnapshot,
    classesRemaining: membership.classesRemaining,
    classesTotal: membership.classesTotal,
    expiresAt: membership.expiresAt,
    membershipStartDate: membership.membershipStartDate,
    membershipEndDate: membership.membershipEndDate,
    paidAt: membership.paidAt,
    renewedFromId: membership.renewedFromId,
  };
}

type CommitLockedMembershipPlanRemovalOptions<
  TContext,
  TMembership extends MembershipPlanRemovalRecord,
  TPlan extends MembershipPlanRemovalPlan,
> = {
  branchId: string;
  membershipId: string;
  actorUserId: string;
  actorRole: string;
  transaction: (work: (context: TContext) => Promise<MembershipPlanRemovalOperationResult<TMembership>>) => Promise<MembershipPlanRemovalOperationResult<TMembership>>;
  validateActorScope: (context: TContext, actorUserId: string, actorRole: string, branchId: string) => Promise<boolean>;
  lockMembership: (context: TContext, membershipId: string, branchId: string) => Promise<TMembership | undefined>;
  loadPlan: (context: TContext, planId: string) => Promise<TPlan | undefined>;
  hasOpenLeaseContract: (context: TContext, membershipId: string, branchId: string) => Promise<boolean>;
  removePlan: (context: TContext, membership: TMembership) => Promise<TMembership | undefined>;
  cancelApplicableFutureBookings: (context: TContext, membership: TMembership) => Promise<number>;
  createAudit: (context: TContext, audit: MembershipPlanRemovalAudit) => Promise<void>;
};

export async function commitLockedMembershipPlanRemoval<
  TContext,
  TMembership extends MembershipPlanRemovalRecord,
  TPlan extends MembershipPlanRemovalPlan,
>(options: CommitLockedMembershipPlanRemovalOptions<TContext, TMembership, TPlan>) {
  return options.transaction(async (context) => {
    const actorScopeIsValid = await options.validateActorScope(
      context,
      options.actorUserId,
      options.actorRole,
      options.branchId,
    );
    if (!actorScopeIsValid) {
      throw new MembershipPlanRemovalError(MEMBERSHIP_PLAN_REMOVAL_FORBIDDEN);
    }

    const membership = await options.lockMembership(context, options.membershipId, options.branchId);
    if (!membership || membership.branchId !== options.branchId) {
      throw new MembershipPlanRemovalError(MEMBERSHIP_PLAN_REMOVAL_NOT_FOUND);
    }

    const disposition = getMembershipPlanRemovalDisposition(membership);
    if (disposition === "already_removed") {
      return {
        membership,
        cancelledBookings: 0,
        idempotentReplay: true,
      };
    }
    if (disposition === "incompatible") {
      throw new MembershipPlanRemovalError(MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT);
    }

    const plan = await options.loadPlan(context, membership.planId!);
    if (!plan || plan.branchId !== options.branchId) {
      throw new MembershipPlanRemovalError(MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT);
    }

    if (await options.hasOpenLeaseContract(context, membership.id, options.branchId)) {
      throw new MembershipPlanRemovalError(MEMBERSHIP_PLAN_REMOVAL_LEASE_BLOCKED);
    }

    const before = buildMembershipPlanRemovalSnapshot(membership);
    const updatedMembership = await options.removePlan(context, membership);
    if (!updatedMembership) {
      throw new MembershipPlanRemovalError(MEMBERSHIP_PLAN_REMOVAL_NOT_FOUND);
    }
    if (getMembershipPlanRemovalDisposition(updatedMembership) !== "already_removed") {
      throw new MembershipPlanRemovalError(MEMBERSHIP_PLAN_REMOVAL_STATE_CONFLICT);
    }

    const cancelledBookings = await options.cancelApplicableFutureBookings(context, membership);
    await options.createAudit(context, {
      actorUserId: options.actorUserId,
      branchId: options.branchId,
      clientUserId: membership.userId,
      membershipId: membership.id,
      previousPlanId: plan.id,
      previousPlanName: plan.name,
      before,
      after: buildMembershipPlanRemovalSnapshot(updatedMembership),
      cancelledBookings,
    });

    return {
      membership: updatedMembership,
      cancelledBookings,
      idempotentReplay: false,
    };
  });
}
