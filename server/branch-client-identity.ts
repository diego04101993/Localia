import { isMembershipOperational } from "./membership-state";

export type BranchClientOriginType = "manual" | "counter" | "app";

export type BranchClientIdentityControl = {
  originType: BranchClientOriginType;
  canEditIdentity: boolean;
  reason: string;
};

export type BranchClientAccessStatus =
  | "NO_ACCESS"
  | "LOCAL_ACCESS"
  | "EXTERNAL_PROVIDER"
  | "DISABLED"
  | "LEGACY_UNVERIFIED";

export type BranchClientAccessProvider = "email" | "google" | "apple" | null;

export type BranchClientAccessEvidence = {
  activeMembershipBranchCount?: number | null;
  hasNoAccessAudit?: boolean;
};

type BranchClientAccessDecisionCode =
  | "LOCAL_ACCESS_AVAILABLE"
  | "LOCAL_ACCESS_NOT_PROVISIONED"
  | "EXTERNAL_AUTH_PROVIDER"
  | "CLIENT_BLOCKED"
  | "CLIENT_MEMBERSHIP_INACTIVE"
  | "EMAIL_REQUIRED"
  | "CLIENT_ACCESS_UNAVAILABLE"
  | "SHARED_IDENTITY_UNSAFE"
  | "LEGACY_ACCESS_UNVERIFIED";

type BranchClientAccessEligibilityCode =
  | "CREATE_ALLOWED"
  | "VERIFY_LEGACY_ALLOWED"
  | "RESET_ALLOWED"
  | "CLIENT_ACCESS_UNAVAILABLE"
  | "CLIENT_MEMBERSHIP_INACTIVE"
  | "CLIENT_EMAIL_REQUIRED"
  | "EXTERNAL_AUTH_ONLY"
  | "PASSWORD_NOT_SET"
  | "CLIENT_BLOCKED"
  | "LOCAL_ACCESS_ALREADY_PROVISIONED"
  | "LOCAL_ACCESS_NOT_PROVISIONED"
  | "SHARED_IDENTITY_UNSAFE"
  | "LEGACY_ACCESS_UNVERIFIED";

export type BranchClientAccessState = {
  accessStatus: BranchClientAccessStatus;
  accessProvider: BranchClientAccessProvider;
  accessEmail: string | null;
  canBranchManageAccess: boolean;
  canCreateLocalAccess: boolean;
  canResetLocalPassword: boolean;
  accessReason: string;
  code: BranchClientAccessDecisionCode;
};

export type BranchClientPasswordResetEligibility = {
  canResetLocalPassword: boolean;
  email: string | null;
  code: BranchClientAccessEligibilityCode;
  reason: string;
};

export type BranchClientCreateAccessEligibility = {
  canCreateLocalAccess: boolean;
  email: string | null;
  code: BranchClientAccessEligibilityCode;
  reason: string;
};

export type BranchClientLegacyVerificationEligibility = {
  canVerifyLegacyLocalAccess: boolean;
  email: string | null;
  code: BranchClientAccessEligibilityCode;
  reason: string;
};

const LOCAL_PASSWORD_AUTH_PROVIDERS = new Set(["", "email", "crm"]);
const GOOGLE_AUTH_PROVIDERS = new Set(["google", "email_google"]);
const APPLE_AUTH_PROVIDERS = new Set(["apple", "email_apple"]);

type AccessUserLike = {
  email?: string | null;
  authProvider?: string | null;
  passwordHash?: string | null;
  firebaseUid?: string | null;
  acceptedTerms?: boolean | null;
  isBlocked?: boolean | null;
  localAccessProvisionedAt?: Date | string | null;
};

type AccessMembershipLike = {
  source?: string | null;
  status?: string | null;
  clientStatus?: string | null;
};

export function isCrmPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.endsWith("@crm.webcool.local");
}

export function normalizeAccessEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeAuthProvider(authProvider: string | null | undefined): string {
  if (typeof authProvider !== "string") {
    return "";
  }
  return authProvider.trim().toLowerCase();
}

export function resolveAccessProvider(authProvider: string | null | undefined): BranchClientAccessProvider {
  const normalizedProvider = normalizeAuthProvider(authProvider);

  if (GOOGLE_AUTH_PROVIDERS.has(normalizedProvider)) {
    return "google";
  }

  if (APPLE_AUTH_PROVIDERS.has(normalizedProvider)) {
    return "apple";
  }

  if (LOCAL_PASSWORD_AUTH_PROVIDERS.has(normalizedProvider) || !normalizedProvider) {
    return "email";
  }

  return null;
}

function hasLocalPasswordHash(user: AccessUserLike | null | undefined): boolean {
  return typeof user?.passwordHash === "string" && user.passwordHash.trim().length > 0;
}

export function supportsLocalPasswordAuth(user: AccessUserLike | null | undefined): boolean {
  const normalizedEmail = normalizeAccessEmail(user?.email);
  const normalizedProvider = normalizeAuthProvider(user?.authProvider);

  return !!normalizedEmail
    && !isCrmPlaceholderEmail(normalizedEmail)
    && (normalizedProvider === "" || normalizedProvider === "email");
}

export function hasPersistedLocalAccess(
  user: AccessUserLike | null | undefined,
  normalizedEmail: string | null,
  accessProvider: BranchClientAccessProvider,
): boolean {
  return !!normalizedEmail
    && !isCrmPlaceholderEmail(normalizedEmail)
    && accessProvider === "email"
    && supportsLocalPasswordAuth(user)
    && hasLocalPasswordHash(user)
    && !!user?.localAccessProvisionedAt;
}

export function hasLegacyLocalCredentials(
  user: AccessUserLike | null | undefined,
  normalizedEmail: string | null,
  accessProvider: BranchClientAccessProvider,
): boolean {
  if (!normalizedEmail || isCrmPlaceholderEmail(normalizedEmail)) {
    return false;
  }

  if (accessProvider !== "email" || !supportsLocalPasswordAuth(user)) {
    return false;
  }

  return hasLocalPasswordHash(user) && !user?.localAccessProvisionedAt;
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
  const normalizedProvider = normalizeAuthProvider(user?.authProvider);
  const hasCounterEvidence =
    membershipSource === "admin_created" ||
    membershipSource === "quick_charge" ||
    isCrmPlaceholderEmail(user?.email) ||
    normalizedProvider === "crm";
  const hasAppSource = membershipSource === "self_join" || membershipSource === "invite";
  const hasAppIdentity =
    !!user?.firebaseUid ||
    !!user?.acceptedTerms ||
    (normalizedProvider.length > 0 && !LOCAL_PASSWORD_AUTH_PROVIDERS.has(normalizedProvider));

  if (hasCounterEvidence) {
    if (isCrmPlaceholderEmail(user?.email) || normalizedProvider === "crm" || membershipSource === "quick_charge") {
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

export function getBranchClientAccessState(
  user: AccessUserLike | null | undefined,
  membership: AccessMembershipLike | null | undefined,
  evidence: BranchClientAccessEvidence = {},
): BranchClientAccessState {
  const identityControl = getBranchClientIdentityControl(user, membership);
  const normalizedEmail = normalizeAccessEmail(user?.email);
  const normalizedProvider = normalizeAuthProvider(user?.authProvider);
  const resolvedProvider = resolveAccessProvider(user?.authProvider);
  const isOperationalMembership = isMembershipOperational(
    membership?.status ?? null,
    membership?.clientStatus ?? "active",
  );
  const isSharedIdentity = Number(evidence.activeMembershipBranchCount ?? 1) > 1;
  const canBeManagedByBranch = identityControl.originType !== "app" && identityControl.canEditIdentity;
  const hasProvisionedAccess = hasPersistedLocalAccess(user, normalizedEmail, resolvedProvider);
  const explicitNoAccessEvidence = !!evidence.hasNoAccessAudit || normalizedProvider === "crm" || !hasLocalPasswordHash(user);
  const hasLegacyCredentials = hasLegacyLocalCredentials(user, normalizedEmail, resolvedProvider);
  const isExternalProvider =
    resolvedProvider === "google"
    || resolvedProvider === "apple"
    || (normalizedProvider.length > 0 && !LOCAL_PASSWORD_AUTH_PROVIDERS.has(normalizedProvider));
  const canBranchManageAccess =
    canBeManagedByBranch
    && !isExternalProvider
    && !isSharedIdentity
    && isOperationalMembership
    && !user?.isBlocked;

  if (!isOperationalMembership) {
    return {
      accessStatus: "DISABLED",
      accessProvider: resolvedProvider,
      accessEmail: normalizedEmail,
      canBranchManageAccess: false,
      canCreateLocalAccess: false,
      canResetLocalPassword: false,
      accessReason: "Solo puedes administrar el acceso de clientes con una relacion operativa en esta sucursal.",
      code: "CLIENT_MEMBERSHIP_INACTIVE",
    };
  }

  if (user?.isBlocked) {
    return {
      accessStatus: "DISABLED",
      accessProvider: resolvedProvider,
      accessEmail: normalizedEmail,
      canBranchManageAccess: false,
      canCreateLocalAccess: false,
      canResetLocalPassword: false,
      accessReason: "Esta cuenta esta bloqueada y no puede administrar su acceso desde la sucursal.",
      code: "CLIENT_BLOCKED",
    };
  }

  if (isExternalProvider) {
    const providerLabel = resolvedProvider === "google" ? "Google" : resolvedProvider === "apple" ? "Apple" : "un proveedor externo";
    return {
      accessStatus: "EXTERNAL_PROVIDER",
      accessProvider: resolvedProvider,
      accessEmail: normalizedEmail,
      canBranchManageAccess: false,
      canCreateLocalAccess: false,
      canResetLocalPassword: false,
      accessReason: `Este cliente administra su acceso mediante ${providerLabel}. No puedes crear ni restablecer una contrasena local desde esta sucursal.`,
      code: "EXTERNAL_AUTH_PROVIDER",
    };
  }

  if (!normalizedEmail || isCrmPlaceholderEmail(normalizedEmail)) {
    return {
      accessStatus: "NO_ACCESS",
      accessProvider: null,
      accessEmail: null,
      canBranchManageAccess,
      canCreateLocalAccess: false,
      canResetLocalPassword: false,
      accessReason: "Este cliente necesita un correo electronico real para poder recibir acceso a la app.",
      code: "EMAIL_REQUIRED",
    };
  }

  if (hasProvisionedAccess) {
    if (isSharedIdentity) {
      return {
        accessStatus: "LOCAL_ACCESS",
        accessProvider: "email",
        accessEmail: normalizedEmail,
        canBranchManageAccess: false,
        canCreateLocalAccess: false,
        canResetLocalPassword: false,
        accessReason: "Esta identidad esta vinculada a mas de una sucursal operativa. Para evitar tomar control de una cuenta compartida, el acceso no puede administrarse desde aqui.",
        code: "SHARED_IDENTITY_UNSAFE",
      };
    }

    if (!canBeManagedByBranch) {
      return {
        accessStatus: "LOCAL_ACCESS",
        accessProvider: "email",
        accessEmail: normalizedEmail,
        canBranchManageAccess: false,
        canCreateLocalAccess: false,
        canResetLocalPassword: false,
        accessReason: "Este cliente administra su acceso desde la app. La sucursal no debe intervenir sobre sus credenciales locales.",
        code: "CLIENT_ACCESS_UNAVAILABLE",
      };
    }

    return {
      accessStatus: "LOCAL_ACCESS",
      accessProvider: "email",
      accessEmail: normalizedEmail,
      canBranchManageAccess: true,
      canCreateLocalAccess: false,
      canResetLocalPassword: true,
      accessReason: "Si olvido su contrasena, puedes generar una nueva temporal. La anterior dejara de funcionar.",
      code: "LOCAL_ACCESS_AVAILABLE",
    };
  }

  if (!canBeManagedByBranch) {
    return {
      accessStatus: "NO_ACCESS",
      accessProvider: hasLegacyCredentials ? "email" : null,
      accessEmail: normalizedEmail,
      canBranchManageAccess: false,
      canCreateLocalAccess: false,
      canResetLocalPassword: false,
      accessReason: "El acceso de este cliente es administrado por su propia cuenta.",
      code: "CLIENT_ACCESS_UNAVAILABLE",
    };
  }

  if (hasLegacyCredentials) {
    const sharedReason = "Esta identidad historica tambien pertenece a otra sucursal operativa. No es seguro modificar su acceso local desde aqui.";
    const unavailableReason = "Esta es una cuenta historica creada antes del flujo actual. Puedes verificar que esta sucursal administra su acceso y generar una nueva contrasena temporal.";
    return {
      accessStatus: "LEGACY_UNVERIFIED",
      accessProvider: "email",
      accessEmail: normalizedEmail,
      canBranchManageAccess,
      canCreateLocalAccess: false,
      canResetLocalPassword: false,
      accessReason: isSharedIdentity ? sharedReason : unavailableReason,
      code: isSharedIdentity ? "SHARED_IDENTITY_UNSAFE" : "LEGACY_ACCESS_UNVERIFIED",
    };
  }

  if (isSharedIdentity) {
    return {
      accessStatus: "NO_ACCESS",
      accessProvider: null,
      accessEmail: normalizedEmail,
      canBranchManageAccess: false,
      canCreateLocalAccess: false,
      canResetLocalPassword: false,
      accessReason: "Esta identidad esta vinculada a mas de una sucursal operativa. Para evitar tomar control de una cuenta compartida, no puedes crear acceso local desde aqui.",
      code: "SHARED_IDENTITY_UNSAFE",
    };
  }

  return {
    accessStatus: "NO_ACCESS",
    accessProvider: explicitNoAccessEvidence ? null : resolvedProvider,
    accessEmail: normalizedEmail,
    canBranchManageAccess,
    canCreateLocalAccess: true,
    canResetLocalPassword: false,
    accessReason: "Este cliente todavia no tiene acceso a la app. Puedes crearlo de forma explicita y la contrasena temporal se mostrara una sola vez.",
    code: "LOCAL_ACCESS_NOT_PROVISIONED",
  };
}

export function getBranchClientCreateAccessEligibility(
  user: AccessUserLike | null | undefined,
  membership: AccessMembershipLike | null | undefined,
  evidence: BranchClientAccessEvidence = {},
): BranchClientCreateAccessEligibility {
  const accessState = getBranchClientAccessState(user, membership, evidence);

  if (accessState.canCreateLocalAccess && accessState.accessEmail) {
    return {
      canCreateLocalAccess: true,
      email: accessState.accessEmail,
      code: "CREATE_ALLOWED",
      reason: "Se generara una contrasena temporal para este cliente.",
    };
  }

  if (accessState.code === "EMAIL_REQUIRED") {
    return {
      canCreateLocalAccess: false,
      email: null,
      code: "CLIENT_EMAIL_REQUIRED",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "EXTERNAL_AUTH_PROVIDER") {
    return {
      canCreateLocalAccess: false,
      email: accessState.accessEmail,
      code: "EXTERNAL_AUTH_ONLY",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "CLIENT_BLOCKED") {
    return {
      canCreateLocalAccess: false,
      email: accessState.accessEmail,
      code: "CLIENT_BLOCKED",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "CLIENT_MEMBERSHIP_INACTIVE") {
    return {
      canCreateLocalAccess: false,
      email: accessState.accessEmail,
      code: "CLIENT_MEMBERSHIP_INACTIVE",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "SHARED_IDENTITY_UNSAFE") {
    return {
      canCreateLocalAccess: false,
      email: accessState.accessEmail,
      code: "SHARED_IDENTITY_UNSAFE",
      reason: accessState.accessReason,
    };
  }

  if (accessState.accessStatus === "LOCAL_ACCESS") {
    return {
      canCreateLocalAccess: false,
      email: accessState.accessEmail,
      code: "LOCAL_ACCESS_ALREADY_PROVISIONED",
      reason: "Este cliente ya tiene acceso local activo. Si necesita ayuda, usa restablecer contrasena.",
    };
  }

  if (accessState.accessStatus === "LEGACY_UNVERIFIED") {
    return {
      canCreateLocalAccess: false,
      email: accessState.accessEmail,
      code: "LEGACY_ACCESS_UNVERIFIED",
      reason: accessState.accessReason,
    };
  }

  return {
    canCreateLocalAccess: false,
    email: accessState.accessEmail,
    code: "CLIENT_ACCESS_UNAVAILABLE",
    reason: accessState.accessReason,
  };
}

export function getBranchClientLegacyAccessVerificationEligibility(
  user: AccessUserLike | null | undefined,
  membership: AccessMembershipLike | null | undefined,
  evidence: BranchClientAccessEvidence = {},
): BranchClientLegacyVerificationEligibility {
  const accessState = getBranchClientAccessState(user, membership, evidence);

  if (
    accessState.accessStatus === "LEGACY_UNVERIFIED"
    && accessState.canBranchManageAccess
    && accessState.accessEmail
    && accessState.accessProvider === "email"
  ) {
    return {
      canVerifyLegacyLocalAccess: true,
      email: accessState.accessEmail,
      code: "VERIFY_LEGACY_ALLOWED",
      reason: "Esta cuenta historica puede verificarse de forma segura desde esta sucursal. Se generara una nueva contrasena temporal y la anterior dejara de funcionar.",
    };
  }

  if (accessState.code === "EMAIL_REQUIRED") {
    return {
      canVerifyLegacyLocalAccess: false,
      email: null,
      code: "CLIENT_EMAIL_REQUIRED",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "EXTERNAL_AUTH_PROVIDER") {
    return {
      canVerifyLegacyLocalAccess: false,
      email: accessState.accessEmail,
      code: "EXTERNAL_AUTH_ONLY",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "CLIENT_BLOCKED") {
    return {
      canVerifyLegacyLocalAccess: false,
      email: accessState.accessEmail,
      code: "CLIENT_BLOCKED",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "CLIENT_MEMBERSHIP_INACTIVE") {
    return {
      canVerifyLegacyLocalAccess: false,
      email: accessState.accessEmail,
      code: "CLIENT_MEMBERSHIP_INACTIVE",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "SHARED_IDENTITY_UNSAFE") {
    return {
      canVerifyLegacyLocalAccess: false,
      email: accessState.accessEmail,
      code: "SHARED_IDENTITY_UNSAFE",
      reason: accessState.accessReason,
    };
  }

  if (accessState.accessStatus === "LOCAL_ACCESS") {
    return {
      canVerifyLegacyLocalAccess: false,
      email: accessState.accessEmail,
      code: "LOCAL_ACCESS_ALREADY_PROVISIONED",
      reason: "Este cliente ya tiene acceso local activo. Si necesita ayuda, usa restablecer contrasena.",
    };
  }

  if (accessState.accessStatus === "NO_ACCESS") {
    return {
      canVerifyLegacyLocalAccess: false,
      email: accessState.accessEmail,
      code: "LOCAL_ACCESS_NOT_PROVISIONED",
      reason: accessState.accessReason,
    };
  }

  return {
    canVerifyLegacyLocalAccess: false,
    email: accessState.accessEmail,
    code: "CLIENT_ACCESS_UNAVAILABLE",
    reason: accessState.accessReason,
  };
}

export function getBranchClientPasswordResetEligibility(
  user: AccessUserLike | null | undefined,
  membership: AccessMembershipLike | null | undefined,
  evidence: BranchClientAccessEvidence = {},
): BranchClientPasswordResetEligibility {
  const accessState = getBranchClientAccessState(user, membership, evidence);

  if (accessState.canResetLocalPassword && accessState.accessEmail) {
    return {
      canResetLocalPassword: true,
      email: accessState.accessEmail,
      code: "RESET_ALLOWED",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "EMAIL_REQUIRED") {
    return {
      canResetLocalPassword: false,
      email: null,
      code: "CLIENT_EMAIL_REQUIRED",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "EXTERNAL_AUTH_PROVIDER") {
    return {
      canResetLocalPassword: false,
      email: accessState.accessEmail,
      code: "EXTERNAL_AUTH_ONLY",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "CLIENT_BLOCKED") {
    return {
      canResetLocalPassword: false,
      email: accessState.accessEmail,
      code: "CLIENT_BLOCKED",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "CLIENT_MEMBERSHIP_INACTIVE") {
    return {
      canResetLocalPassword: false,
      email: accessState.accessEmail,
      code: "CLIENT_MEMBERSHIP_INACTIVE",
      reason: accessState.accessReason,
    };
  }

  if (accessState.code === "SHARED_IDENTITY_UNSAFE") {
    return {
      canResetLocalPassword: false,
      email: accessState.accessEmail,
      code: "SHARED_IDENTITY_UNSAFE",
      reason: accessState.accessReason,
    };
  }

  if (accessState.accessStatus === "LEGACY_UNVERIFIED") {
    return {
      canResetLocalPassword: false,
      email: accessState.accessEmail,
      code: "LEGACY_ACCESS_UNVERIFIED",
      reason: accessState.accessReason,
    };
  }

  if (accessState.accessStatus === "NO_ACCESS") {
    return {
      canResetLocalPassword: false,
      email: accessState.accessEmail,
      code: "LOCAL_ACCESS_NOT_PROVISIONED",
      reason: accessState.accessReason,
    };
  }

  return {
    canResetLocalPassword: false,
    email: accessState.accessEmail,
    code: "CLIENT_ACCESS_UNAVAILABLE",
    reason: accessState.accessReason,
  };
}
