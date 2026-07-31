export type BranchClientOriginType = "manual" | "counter" | "app";

export type BranchClientIdentityControl = {
  originType: BranchClientOriginType;
  canEditIdentity: boolean;
  reason: string;
};

export type BranchClientPasswordResetEligibility = {
  canResetLocalPassword: boolean;
  email: string | null;
  code:
    | "RESET_ALLOWED"
    | "CLIENT_ACCESS_UNAVAILABLE"
    | "CLIENT_MEMBERSHIP_INACTIVE"
    | "CLIENT_EMAIL_REQUIRED"
    | "EXTERNAL_AUTH_ONLY"
    | "PASSWORD_NOT_SET"
    | "CLIENT_BLOCKED";
  reason: string;
};

const LOCAL_PASSWORD_AUTH_PROVIDERS = new Set(["email", "crm", "email_google", "email_apple"]);

export function isCrmPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.endsWith("@crm.webcool.local");
}

function normalizeAccessEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
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

export function getBranchClientPasswordResetEligibility(
  user: {
    email?: string | null;
    authProvider?: string | null;
    passwordHash?: string | null;
    firebaseUid?: string | null;
    acceptedTerms?: boolean | null;
    isBlocked?: boolean | null;
  } | null | undefined,
  membership: {
    source?: string | null;
    status?: string | null;
    clientStatus?: string | null;
  } | null | undefined,
): BranchClientPasswordResetEligibility {
  const identityControl = getBranchClientIdentityControl(user, membership);
  if (identityControl.originType !== "manual") {
    return {
      canResetLocalPassword: false,
      email: null,
      code: "CLIENT_ACCESS_UNAVAILABLE",
      reason: "Esta acción solo está disponible para clientes agregados manualmente por la sucursal.",
    };
  }

  if ((membership?.status ?? null) !== "active" || (membership?.clientStatus ?? "active") !== "active") {
    return {
      canResetLocalPassword: false,
      email: null,
      code: "CLIENT_MEMBERSHIP_INACTIVE",
      reason: "Solo puedes restablecer el acceso de clientes activos en esta sucursal.",
    };
  }

  if (user?.isBlocked) {
    return {
      canResetLocalPassword: false,
      email: null,
      code: "CLIENT_BLOCKED",
      reason: "Esta cuenta está bloqueada y no puede restablecer su acceso desde la sucursal.",
    };
  }

  const normalizedEmail = normalizeAccessEmail(user?.email);
  if (!normalizedEmail || isCrmPlaceholderEmail(normalizedEmail)) {
    return {
      canResetLocalPassword: false,
      email: null,
      code: "CLIENT_EMAIL_REQUIRED",
      reason: "Este cliente no tiene un correo real registrado. Agrega un correo antes de restablecer el acceso.",
    };
  }

  const authProvider =
    typeof user?.authProvider === "string" && user.authProvider.trim().length > 0
      ? user.authProvider.trim().toLowerCase()
      : "email";
  if (!LOCAL_PASSWORD_AUTH_PROVIDERS.has(authProvider)) {
    return {
      canResetLocalPassword: false,
      email: normalizedEmail,
      code: "EXTERNAL_AUTH_ONLY",
      reason: "Este cliente usa Google o Apple para iniciar sesión. Debe recuperar el acceso con ese proveedor.",
    };
  }

  if (typeof user?.passwordHash !== "string" || user.passwordHash.trim().length === 0) {
    return {
      canResetLocalPassword: false,
      email: normalizedEmail,
      code: "PASSWORD_NOT_SET",
      reason: "Esta cuenta no tiene una contraseña local válida para restablecer.",
    };
  }

  return {
    canResetLocalPassword: true,
    email: normalizedEmail,
    code: "RESET_ALLOWED",
    reason: "Si olvidó su contraseña, puedes generar una nueva temporal. La anterior dejará de funcionar.",
  };
}
