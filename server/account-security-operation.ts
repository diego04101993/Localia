import { supportsLocalPasswordAuth } from "./branch-client-identity";

export const ACCOUNT_SECURITY_AUTHENTICATION_FAILED = "ACCOUNT_SECURITY_AUTHENTICATION_FAILED";
export const ACCOUNT_SECURITY_LOCAL_AUTH_REQUIRED = "ACCOUNT_SECURITY_LOCAL_AUTH_REQUIRED";
export const ACCOUNT_SECURITY_ACCOUNT_BLOCKED = "ACCOUNT_SECURITY_ACCOUNT_BLOCKED";
export const ACCOUNT_SECURITY_EMAIL_CONFLICT = "ACCOUNT_SECURITY_EMAIL_CONFLICT";

export type LocalAccountSecurityUser = {
  id: string;
  email: string | null;
  passwordHash: string | null;
  authProvider: string | null;
  isBlocked?: boolean | null;
  branchId?: string | null;
};

export type AccountSecurityAudit = {
  actorUserId: string;
  action: "CHANGE_PASSWORD" | "CHANGE_EMAIL";
  branchId: string | null;
  metadata: {
    clientId: string;
    result: "success";
    sessionsInvalidated: number;
    resetTokensInvalidated: number;
  };
};

export class AccountSecurityError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AccountSecurityError";
  }
}

type AccountSecurityCommonOptions<TContext, TUser extends LocalAccountSecurityUser> = {
  userId: string;
  currentPassword: string;
  currentSessionId: string;
  transaction: <TResult>(work: (context: TContext) => Promise<TResult>) => Promise<TResult>;
  lockUser: (context: TContext, userId: string) => Promise<TUser | undefined>;
  verifyCurrentPassword: (plainPassword: string, passwordHash: string) => Promise<boolean>;
  invalidateResetTokens: (context: TContext, userId: string) => Promise<number>;
  revokeOtherSessions: (context: TContext, userId: string, currentSessionId: string) => Promise<number>;
  createAudit: (context: TContext, audit: AccountSecurityAudit) => Promise<void>;
};

async function requireAuthenticatedLocalUser<TContext, TUser extends LocalAccountSecurityUser>(
  context: TContext,
  options: AccountSecurityCommonOptions<TContext, TUser>,
): Promise<TUser> {
  const user = await options.lockUser(context, options.userId);
  if (!user?.passwordHash) {
    throw new AccountSecurityError(ACCOUNT_SECURITY_AUTHENTICATION_FAILED);
  }
  if (user.isBlocked) {
    throw new AccountSecurityError(ACCOUNT_SECURITY_ACCOUNT_BLOCKED);
  }
  if (!supportsLocalPasswordAuth(user)) {
    throw new AccountSecurityError(ACCOUNT_SECURITY_LOCAL_AUTH_REQUIRED);
  }
  if (!await options.verifyCurrentPassword(options.currentPassword, user.passwordHash)) {
    throw new AccountSecurityError(ACCOUNT_SECURITY_AUTHENTICATION_FAILED);
  }
  return user;
}

export async function commitLocalPasswordChange<
  TContext,
  TUser extends LocalAccountSecurityUser,
>(options: AccountSecurityCommonOptions<TContext, TUser> & {
  newPasswordHash: string;
  updatePassword: (context: TContext, userId: string, passwordHash: string) => Promise<TUser | undefined>;
}): Promise<{
  user: TUser;
  sessionsInvalidated: number;
  resetTokensInvalidated: number;
}> {
  return options.transaction(async (context) => {
    const currentUser = await requireAuthenticatedLocalUser(context, options);
    const updatedUser = await options.updatePassword(context, currentUser.id, options.newPasswordHash);
    if (!updatedUser) {
      throw new AccountSecurityError(ACCOUNT_SECURITY_AUTHENTICATION_FAILED);
    }

    const resetTokensInvalidated = await options.invalidateResetTokens(context, currentUser.id);
    const sessionsInvalidated = await options.revokeOtherSessions(
      context,
      currentUser.id,
      options.currentSessionId,
    );
    await options.createAudit(context, {
      actorUserId: currentUser.id,
      action: "CHANGE_PASSWORD",
      branchId: currentUser.branchId ?? null,
      metadata: {
        clientId: currentUser.id,
        result: "success",
        sessionsInvalidated,
        resetTokensInvalidated,
      },
    });

    return { user: updatedUser, sessionsInvalidated, resetTokensInvalidated };
  });
}

export function normalizeAccountEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function commitLocalEmailChange<
  TContext,
  TUser extends LocalAccountSecurityUser,
>(options: AccountSecurityCommonOptions<TContext, TUser> & {
  newEmail: string;
  lockEmail: (context: TContext, normalizedEmail: string) => Promise<void>;
  findUserByEmail: (context: TContext, normalizedEmail: string) => Promise<TUser | undefined>;
  updateEmail: (context: TContext, userId: string, normalizedEmail: string) => Promise<TUser | undefined>;
}): Promise<{
  user: TUser;
  changed: boolean;
  sessionsInvalidated: number;
  resetTokensInvalidated: number;
}> {
  const normalizedEmail = normalizeAccountEmail(options.newEmail);

  return options.transaction(async (context) => {
    const currentUser = await requireAuthenticatedLocalUser(context, options);
    if (normalizeAccountEmail(currentUser.email ?? "") === normalizedEmail) {
      return {
        user: currentUser,
        changed: false,
        sessionsInvalidated: 0,
        resetTokensInvalidated: 0,
      };
    }

    await options.lockEmail(context, normalizedEmail);
    const existingUser = await options.findUserByEmail(context, normalizedEmail);
    if (existingUser && existingUser.id !== currentUser.id) {
      throw new AccountSecurityError(ACCOUNT_SECURITY_EMAIL_CONFLICT);
    }

    const updatedUser = await options.updateEmail(context, currentUser.id, normalizedEmail);
    if (!updatedUser) {
      throw new AccountSecurityError(ACCOUNT_SECURITY_AUTHENTICATION_FAILED);
    }

    const resetTokensInvalidated = await options.invalidateResetTokens(context, currentUser.id);
    const sessionsInvalidated = await options.revokeOtherSessions(
      context,
      currentUser.id,
      options.currentSessionId,
    );
    await options.createAudit(context, {
      actorUserId: currentUser.id,
      action: "CHANGE_EMAIL",
      branchId: currentUser.branchId ?? null,
      metadata: {
        clientId: currentUser.id,
        result: "success",
        sessionsInvalidated,
        resetTokensInvalidated,
      },
    });

    return {
      user: updatedUser,
      changed: true,
      sessionsInvalidated,
      resetTokensInvalidated,
    };
  });
}
