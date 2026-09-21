export function canAccessRequestedRoles(params: {
  effectiveRole: string;
  requestedRoles: readonly string[];
  impersonating: boolean;
}): boolean {
  const isSuperAdminOnly = params.requestedRoles.length > 0
    && params.requestedRoles.every((role) => role === "SUPER_ADMIN");
  if (params.impersonating && isSuperAdminOnly) {
    return false;
  }
  return params.requestedRoles.includes(params.effectiveRole);
}
