import type { InsertMembership } from "@shared/schema";

export type MembershipRelationStatus = "active" | "left" | "banned";
export type MembershipOperationalStatus = "active" | "inactive" | "frozen";

export const MEMBERSHIP_STATE_MATRIX = {
  active: ["active", "inactive", "frozen"],
  left: ["inactive"],
  banned: ["inactive"],
} as const satisfies Record<MembershipRelationStatus, readonly MembershipOperationalStatus[]>;

export const ACTIVE_MEMBERSHIP_CLIENT_STATUSES = MEMBERSHIP_STATE_MATRIX.active;

export function isMembershipOperational(
  status: MembershipRelationStatus | string | null | undefined,
  clientStatus: MembershipOperationalStatus | string | null | undefined,
): boolean {
  return status === "active" && ACTIVE_MEMBERSHIP_CLIENT_STATUSES.includes((clientStatus ?? "active") as MembershipOperationalStatus);
}

export function buildMembershipActivePatch(
  source?: InsertMembership["source"] | null,
): Partial<InsertMembership> {
  return {
    status: "active",
    clientStatus: "active",
    ...(source ? { source } : {}),
  };
}

export function buildMembershipLeftPatch(): Partial<InsertMembership> {
  return {
    status: "left",
    clientStatus: "inactive",
  };
}
