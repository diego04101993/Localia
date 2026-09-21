import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_SECURITY_EMAIL_CONFLICT,
  ACCOUNT_SECURITY_LOCAL_AUTH_REQUIRED,
  AccountSecurityError,
  commitLocalEmailChange,
  commitLocalPasswordChange,
} from "../server/account-security-operation";

type TestUser = {
  id: string;
  email: string | null;
  passwordHash: string;
  authProvider: string;
  isBlocked: boolean;
  branchId: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  emailVerificationToken: string | null;
};

type State = {
  user: TestUser;
  usersByEmail: Map<string, TestUser>;
  sessions: Set<string>;
  resetTokens: Array<{ id: string; used: boolean }>;
  audits: Array<{ action: string; metadata: Record<string, unknown> }>;
};

function cloneState(state: State): State {
  return {
    user: { ...state.user },
    usersByEmail: new Map([...state.usersByEmail].map(([key, user]) => [key, { ...user }])),
    sessions: new Set(state.sessions),
    resetTokens: state.resetTokens.map((token) => ({ ...token })),
    audits: state.audits.map((audit) => ({ ...audit, metadata: { ...audit.metadata } })),
  };
}

function createState(overrides: Partial<TestUser> = {}): State {
  const user: TestUser = {
    id: "user-1",
    email: "local@example.test",
    passwordHash: "old-hash",
    authProvider: "email",
    isBlocked: false,
    branchId: null,
    emailVerified: true,
    emailVerifiedAt: "2026-09-01T00:00:00.000Z",
    emailVerificationToken: "old-verification-token",
    ...overrides,
  };
  return {
    user,
    usersByEmail: new Map([[user.email!, user]]),
    sessions: new Set(["current-session", "other-session"]),
    resetTokens: [{ id: "token-1", used: false }],
    audits: [],
  };
}

function createHarness(initial = createState(), failAudit = false) {
  let state = cloneState(initial);

  const transaction = async <T>(work: (draft: State) => Promise<T>): Promise<T> => {
    const draft = cloneState(state);
    const result = await work(draft);
    state = draft;
    return result;
  };

  const common = {
    userId: "user-1",
    currentPassword: "correct-password",
    currentSessionId: "current-session",
    transaction,
    lockUser: async (draft: State) => draft.user,
    verifyCurrentPassword: async (plain: string, hash: string) => (
      plain === "correct-password" && hash === "old-hash"
    ),
    invalidateResetTokens: async (draft: State) => {
      let count = 0;
      for (const token of draft.resetTokens) {
        if (!token.used) {
          token.used = true;
          count += 1;
        }
      }
      return count;
    },
    revokeOtherSessions: async (draft: State, _userId: string, currentSessionId: string) => {
      let count = 0;
      for (const sessionId of [...draft.sessions]) {
        if (sessionId !== currentSessionId) {
          draft.sessions.delete(sessionId);
          count += 1;
        }
      }
      return count;
    },
    createAudit: async (draft: State, audit: any) => {
      if (failAudit) throw new Error("AUDIT_FAILED");
      draft.audits.push(audit);
    },
  };

  return {
    changePassword: () => commitLocalPasswordChange({
      ...common,
      newPasswordHash: "new-hash",
      updatePassword: async (draft, _userId, passwordHash) => {
        draft.user.passwordHash = passwordHash;
        return draft.user;
      },
    }),
    changeEmail: (newEmail: string) => commitLocalEmailChange({
      ...common,
      newEmail,
      lockEmail: async () => {},
      findUserByEmail: async (draft, normalizedEmail) => draft.usersByEmail.get(normalizedEmail),
      updateEmail: async (draft, _userId, normalizedEmail) => {
        draft.usersByEmail.delete(draft.user.email!);
        draft.user.email = normalizedEmail;
        draft.user.emailVerified = false;
        draft.user.emailVerifiedAt = null;
        draft.user.emailVerificationToken = null;
        draft.usersByEmail.set(normalizedEmail, draft.user);
        return draft.user;
      },
    }),
    getState: () => state,
  };
}

test("local password change invalidates reset tokens and other sessions but preserves the current session", async () => {
  const harness = createHarness();
  const result = await harness.changePassword();

  assert.equal(result.user.passwordHash, "new-hash");
  assert.equal(result.resetTokensInvalidated, 1);
  assert.equal(result.sessionsInvalidated, 1);
  assert.deepEqual([...harness.getState().sessions], ["current-session"]);
  assert.equal(harness.getState().resetTokens[0].used, true);
  assert.equal(harness.getState().audits[0].action, "CHANGE_PASSWORD");
  assert.equal(harness.getState().user.authProvider, "email");
});

test("Google and Apple users with residual password hashes cannot change a local password", async () => {
  for (const authProvider of ["google", "apple"]) {
    const harness = createHarness(createState({ authProvider }));
    await assert.rejects(harness.changePassword(), (error: unknown) => {
      assert.ok(error instanceof AccountSecurityError);
      assert.equal(error.code, ACCOUNT_SECURITY_LOCAL_AUTH_REQUIRED);
      return true;
    });
    assert.equal(harness.getState().user.passwordHash, "old-hash");
  }
});

test("password change rolls back password, tokens and sessions when audit creation fails", async () => {
  const harness = createHarness(createState(), true);
  await assert.rejects(harness.changePassword(), /AUDIT_FAILED/);

  assert.equal(harness.getState().user.passwordHash, "old-hash");
  assert.equal(harness.getState().resetTokens[0].used, false);
  assert.deepEqual([...harness.getState().sessions].sort(), ["current-session", "other-session"]);
  assert.equal(harness.getState().audits.length, 0);
});

test("email change normalizes the address, resets verification and revokes other sessions", async () => {
  const harness = createHarness();
  const result = await harness.changeEmail("  NEW@Example.Test ");

  assert.equal(result.changed, true);
  assert.equal(harness.getState().user.email, "new@example.test");
  assert.equal(harness.getState().user.emailVerified, false);
  assert.equal(harness.getState().user.emailVerifiedAt, null);
  assert.equal(harness.getState().user.emailVerificationToken, null);
  assert.deepEqual([...harness.getState().sessions], ["current-session"]);
  assert.equal(harness.getState().audits[0].action, "CHANGE_EMAIL");
});

test("duplicate normalized email is rejected without partial changes", async () => {
  const initial = createState();
  initial.usersByEmail.set("taken@example.test", {
    ...initial.user,
    id: "user-2",
    email: "taken@example.test",
  });
  const harness = createHarness(initial);

  await assert.rejects(harness.changeEmail("TAKEN@example.test"), (error: unknown) => {
    assert.ok(error instanceof AccountSecurityError);
    assert.equal(error.code, ACCOUNT_SECURITY_EMAIL_CONFLICT);
    return true;
  });
  assert.equal(harness.getState().user.email, "local@example.test");
  assert.equal(harness.getState().resetTokens[0].used, false);
  assert.equal(harness.getState().sessions.size, 2);
});

test("email change rolls back all state when audit creation fails", async () => {
  const harness = createHarness(createState(), true);
  await assert.rejects(harness.changeEmail("new@example.test"), /AUDIT_FAILED/);

  assert.equal(harness.getState().user.email, "local@example.test");
  assert.equal(harness.getState().user.emailVerified, true);
  assert.equal(harness.getState().resetTokens[0].used, false);
  assert.equal(harness.getState().sessions.size, 2);
});
