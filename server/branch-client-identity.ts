export type BranchClientOriginType = "manual" | "counter" | "app";

export type BranchClientIdentityControl = {
  originType: BranchClientOriginType;
  canEditIdentity: boolean;
  reason: string;
};

export function isCrmPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.endsWith("@crm.webcool.local");
}

export function getBranchClientIdentityControl(
  user: {
    email?: string | null;
    authProvider?: string | null;
    firebaseUid?: string | null;
    acceptedTerms?: boolean | null;
  } | null | undefined,
  membership: {
    source?: string | null;
  } | null | undefined,
): BranchClientIdentityControl {
  const membershipSource = membership?.source ?? null;
  const hasCounterEvidence =
    membershipSource === "admin_created" ||
    membershipSource === "quick_charge" ||
    isCrmPlaceholderEmail(user?.email) ||
    user?.authProvider === "crm";
  const hasAppSource = membershipSource === "self_join" || membershipSource === "invite";
  const hasAppIdentity =
    !!user?.firebaseUid ||
    !!user?.acceptedTerms ||
    (typeof user?.authProvider === "string" &&
      user.authProvider !== "email" &&
      user.authProvider !== "crm");

  if (hasCounterEvidence) {
    if (isCrmPlaceholderEmail(user?.email) || user?.authProvider === "crm" || membershipSource === "quick_charge") {
      return {
        originType: "counter",
        canEditIdentity: true,
        reason: "Cliente creado por mostrador o cobro rapido.",
      };
    }

    return {
      originType: "manual",
      canEditIdentity: true,
      reason: "Cliente agregado manualmente por la sucursal.",
    };
  }

  if (hasAppSource || hasAppIdentity) {
    return {
      originType: "app",
      canEditIdentity: false,
      reason: "Este cliente administra sus datos desde la app.",
    };
  }

  return {
    originType: "manual",
    canEditIdentity: true,
    reason: "Cliente agregado manualmente por la sucursal.",
  };
}
