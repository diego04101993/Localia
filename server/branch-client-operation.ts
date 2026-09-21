import {
  getBranchClientIdentityControl,
  normalizeAccessEmail,
} from "./branch-client-identity";
import { buildMembershipLeftPatch } from "./membership-state";

export const BRANCH_CLIENT_NOT_FOUND = "BRANCH_CLIENT_NOT_FOUND";
export const BRANCH_CLIENT_NO_CHANGES = "BRANCH_CLIENT_NO_CHANGES";
export const BRANCH_CLIENT_IDENTITY_MANAGED_BY_APP = "IDENTITY_MANAGED_BY_APP";
export const BRANCH_CLIENT_SHARED_IDENTITY = "SHARED_IDENTITY_UNSAFE";
export const BRANCH_CLIENT_DUPLICATE = "DUPLICATE_CLIENT";
export const BRANCH_CLIENT_AMBIGUOUS_DUPLICATE = "AMBIGUOUS_DUPLICATE";
export const BRANCH_CLIENT_INVALID_PHONE = "INVALID_PHONE";
export const BRANCH_CLIENT_ALREADY_DELETED = "BRANCH_CLIENT_ALREADY_DELETED";

export type BranchClientGlobalPatch = {
  name?: string;
  email?: string | null;
  lastName?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  avatarUrl?: string | null;
};

export type BranchClientPrivatePatch = {
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  medicalNotes?: string | null;
  injuriesNotes?: string | null;
  medicalWarnings?: string | null;
  parqAccepted?: boolean;
  parqAcceptedDate?: string | null;
};

export type BranchClientCrmPatch = {
  clientStatus?: string | null;
  tags?: string | null;
};

export type BranchClientOperationUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  authProvider?: string | null;
  firebaseUid?: string | null;
  acceptedTerms?: boolean | null;
};

export type BranchClientOperationMembership = {
  id: string;
  branchId: string;
  userId: string;
  status: string;
  clientStatus: string;
  source?: string | null;
  joinedAt?: Date | string | null;
};

export type BranchClientDuplicateCandidate = {
  userId: string;
  membershipId?: string | null;
  membershipStatus?: string | null;
  name?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export class BranchClientOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly details?: { candidate?: BranchClientDuplicateCandidate },
  ) {
    super(code);
    this.name = "BranchClientOperationError";
  }
}

export function normalizeBranchClientPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("521") && digits.length === 13) return `52${digits.slice(3)}`;
  if (digits.startsWith("52")) return digits;
  if (digits.startsWith("1") && digits.length === 11) return `52${digits.slice(1)}`;
  if (digits.length === 10) return `52${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export async function commitBranchClientEdit<
  TContext,
  TUser extends BranchClientOperationUser,
  TMembership extends BranchClientOperationMembership,
  TBranchProfile,
>(options: {
  actorUserId: string;
  branchId: string;
  clientId: string;
  globalPatch: BranchClientGlobalPatch;
  privatePatch: BranchClientPrivatePatch;
  crmPatch: BranchClientCrmPatch;
  auditAction?: "UPDATE_CLIENT" | "UPDATE_CLIENT_CRM";
  transaction: <TResult>(work: (context: TContext) => Promise<TResult>) => Promise<TResult>;
  lockMembership: (context: TContext, branchId: string, clientId: string) => Promise<TMembership | undefined>;
  lockUser: (context: TContext, clientId: string) => Promise<TUser | undefined>;
  countOperationalBranches: (context: TContext, clientId: string) => Promise<number>;
  findUserByEmail: (context: TContext, normalizedEmail: string) => Promise<TUser | undefined>;
  findPhoneMatches: (
    context: TContext,
    branchId: string,
    normalizedPhone: string,
    excludedClientId: string,
  ) => Promise<BranchClientDuplicateCandidate[]>;
  updateUser: (context: TContext, clientId: string, patch: BranchClientGlobalPatch) => Promise<TUser | undefined>;
  upsertBranchProfile: (
    context: TContext,
    branchId: string,
    clientId: string,
    patch: BranchClientPrivatePatch & BranchClientCrmPatch,
    membership: TMembership,
    initializePrivateProfile: boolean,
  ) => Promise<TBranchProfile>;
  createAudit: (context: TContext, audit: {
    actorUserId: string;
    action: "UPDATE_CLIENT" | "UPDATE_CLIENT_CRM";
    branchId: string;
    metadata: {
      clientId: string;
      membershipId: string;
      globalFields: string[];
      privateFields: string[];
      crmFields: string[];
    };
  }) => Promise<void>;
}): Promise<{ user: TUser | null; privateProfile: TBranchProfile | null }> {
  const globalFields = Object.keys(options.globalPatch);
  const privateFields = Object.keys(options.privatePatch);
  const crmFields = Object.keys(options.crmPatch);
  if (globalFields.length === 0 && privateFields.length === 0 && crmFields.length === 0) {
    throw new BranchClientOperationError(BRANCH_CLIENT_NO_CHANGES);
  }

  return options.transaction(async (context) => {
    const membership = await options.lockMembership(context, options.branchId, options.clientId);
    if (
      !membership
      || membership.branchId !== options.branchId
      || membership.userId !== options.clientId
      || membership.status !== "active"
    ) {
      throw new BranchClientOperationError(BRANCH_CLIENT_NOT_FOUND);
    }

    const currentUser = await options.lockUser(context, options.clientId);
    if (!currentUser) {
      throw new BranchClientOperationError(BRANCH_CLIENT_NOT_FOUND);
    }

    let updatedUser: TUser | null = null;
    if (globalFields.length > 0) {
      const activeMembershipBranchCount = await options.countOperationalBranches(context, options.clientId);
      const identityControl = getBranchClientIdentityControl(currentUser, membership, {
        activeMembershipBranchCount,
      });
      if (!identityControl.canEditIdentity) {
        throw new BranchClientOperationError(
          activeMembershipBranchCount > 1
            ? BRANCH_CLIENT_SHARED_IDENTITY
            : BRANCH_CLIENT_IDENTITY_MANAGED_BY_APP,
        );
      }

      const normalizedPatch: BranchClientGlobalPatch = { ...options.globalPatch };
      if (options.globalPatch.email !== undefined) {
        const normalizedEmail = normalizeAccessEmail(options.globalPatch.email);
        normalizedPatch.email = normalizedEmail;
        if (normalizedEmail !== normalizeAccessEmail(currentUser.email)) {
          const existing = normalizedEmail
            ? await options.findUserByEmail(context, normalizedEmail)
            : undefined;
          if (existing && existing.id !== options.clientId) {
            throw new BranchClientOperationError(BRANCH_CLIENT_DUPLICATE);
          }
        }
      }

      if (options.globalPatch.phone !== undefined) {
        const normalizedPhone = normalizeBranchClientPhone(options.globalPatch.phone);
        if (options.globalPatch.phone && !normalizedPhone) {
          throw new BranchClientOperationError(BRANCH_CLIENT_INVALID_PHONE);
        }
        if (normalizedPhone) {
          const matches = await options.findPhoneMatches(
            context,
            options.branchId,
            normalizedPhone,
            options.clientId,
          );
          if (matches.length > 1) {
            throw new BranchClientOperationError(BRANCH_CLIENT_AMBIGUOUS_DUPLICATE);
          }
          if (matches.length === 1) {
            throw new BranchClientOperationError(BRANCH_CLIENT_DUPLICATE, {
              candidate: matches[0],
            });
          }
        }
      }

      updatedUser = await options.updateUser(context, options.clientId, normalizedPatch) ?? null;
      if (!updatedUser) {
        throw new BranchClientOperationError(BRANCH_CLIENT_NOT_FOUND);
      }
    }

    const privateProfile = privateFields.length > 0 || crmFields.length > 0
      ? await options.upsertBranchProfile(
          context,
          options.branchId,
          options.clientId,
          { ...options.privatePatch, ...options.crmPatch },
          membership,
          privateFields.length > 0,
        )
      : null;

    await options.createAudit(context, {
      actorUserId: options.actorUserId,
      action: options.auditAction ?? "UPDATE_CLIENT",
      branchId: options.branchId,
      metadata: {
        clientId: options.clientId,
        membershipId: membership.id,
        globalFields,
        privateFields,
        crmFields,
      },
    });

    return { user: updatedUser, privateProfile };
  });
}

export async function commitBranchClientSoftDelete<
  TContext,
  TMembership extends BranchClientOperationMembership,
>(options: {
  actorUserId: string;
  branchId: string;
  clientId: string;
  transaction: <TResult>(work: (context: TContext) => Promise<TResult>) => Promise<TResult>;
  lockMembership: (context: TContext, branchId: string, clientId: string) => Promise<TMembership | undefined>;
  updateMembership: (
    context: TContext,
    membershipId: string,
    patch: ReturnType<typeof buildMembershipLeftPatch>,
  ) => Promise<TMembership | undefined>;
  createAudit: (context: TContext, audit: {
    actorUserId: string;
    action: "SOFT_DELETE_CLIENT";
    branchId: string;
    metadata: { clientId: string; membershipId: string };
  }) => Promise<void>;
}): Promise<TMembership> {
  return options.transaction(async (context) => {
    const membership = await options.lockMembership(context, options.branchId, options.clientId);
    if (
      !membership
      || membership.branchId !== options.branchId
      || membership.userId !== options.clientId
    ) {
      throw new BranchClientOperationError(BRANCH_CLIENT_NOT_FOUND);
    }
    if (membership.status === "left") {
      throw new BranchClientOperationError(BRANCH_CLIENT_ALREADY_DELETED);
    }

    const updated = await options.updateMembership(
      context,
      membership.id,
      buildMembershipLeftPatch(),
    );
    if (!updated) {
      throw new BranchClientOperationError(BRANCH_CLIENT_NOT_FOUND);
    }

    await options.createAudit(context, {
      actorUserId: options.actorUserId,
      action: "SOFT_DELETE_CLIENT",
      branchId: options.branchId,
      metadata: { clientId: options.clientId, membershipId: membership.id },
    });

    return updated;
  });
}
