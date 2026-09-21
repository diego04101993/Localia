import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAuditLogAttribution,
  runWithAuditAttributionContext,
} from "../server/audit-context";
import { canAccessRequestedRoles } from "../server/authorization-policy";

test("support mode cannot use routes reserved for SUPER_ADMIN", () => {
  assert.equal(canAccessRequestedRoles({
    effectiveRole: "BRANCH_ADMIN",
    requestedRoles: ["SUPER_ADMIN"],
    impersonating: true,
  }), false);
  assert.equal(canAccessRequestedRoles({
    effectiveRole: "SUPER_ADMIN",
    requestedRoles: ["SUPER_ADMIN"],
    impersonating: false,
  }), true);
});

test("support mode can use the effective branch role", () => {
  assert.equal(canAccessRequestedRoles({
    effectiveRole: "BRANCH_ADMIN",
    requestedRoles: ["BRANCH_ADMIN"],
    impersonating: true,
  }), true);
  assert.equal(canAccessRequestedRoles({
    effectiveRole: "BRANCH_ADMIN",
    requestedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
    impersonating: true,
  }), true);
});

test("audit attribution records the real support actor and effective identity", () => {
  const attributed = runWithAuditAttributionContext({
    impersonating: true,
    originalUserId: "super-admin-id",
    effectiveUserId: "branch-admin-id",
    effectiveRole: "BRANCH_ADMIN",
    effectiveBranchId: "branch-id",
  }, () => resolveAuditLogAttribution({
    actorUserId: "branch-admin-id",
    metadata: { operation: "update" },
  }));

  assert.equal(attributed.actorUserId, "super-admin-id");
  assert.deepEqual(attributed.metadata, {
    operation: "update",
    supportContext: {
      impersonatedUserId: "branch-admin-id",
      impersonatedRole: "BRANCH_ADMIN",
      impersonatedBranchId: "branch-id",
    },
  });
});

test("normal requests preserve their supplied audit actor", () => {
  const attributed = runWithAuditAttributionContext({
    impersonating: false,
    originalUserId: null,
    effectiveUserId: "branch-admin-id",
    effectiveRole: "BRANCH_ADMIN",
    effectiveBranchId: "branch-id",
  }, () => resolveAuditLogAttribution({
    actorUserId: "branch-admin-id",
    metadata: { operation: "update" },
  }));

  assert.deepEqual(attributed, {
    actorUserId: "branch-admin-id",
    metadata: { operation: "update" },
  });
});

test("concurrent support requests keep audit actors and branches isolated across awaits", async () => {
  let releaseFirst!: () => void;
  const firstCanContinue = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const first = runWithAuditAttributionContext({
    impersonating: true,
    originalUserId: "support-a",
    effectiveUserId: "admin-a",
    effectiveRole: "BRANCH_ADMIN",
    effectiveBranchId: "branch-a",
  }, async () => {
    await firstCanContinue;
    return resolveAuditLogAttribution({ actorUserId: "admin-a", metadata: {} });
  });
  const second = await runWithAuditAttributionContext({
    impersonating: true,
    originalUserId: "support-b",
    effectiveUserId: "admin-b",
    effectiveRole: "BRANCH_ADMIN",
    effectiveBranchId: "branch-b",
  }, async () => {
    await Promise.resolve();
    return resolveAuditLogAttribution({ actorUserId: "admin-b", metadata: {} });
  });
  releaseFirst();
  const firstResult = await first;

  assert.equal(firstResult.actorUserId, "support-a");
  assert.equal(second.actorUserId, "support-b");
  assert.deepEqual(firstResult.metadata, {
    supportContext: {
      impersonatedUserId: "admin-a",
      impersonatedRole: "BRANCH_ADMIN",
      impersonatedBranchId: "branch-a",
    },
  });
  assert.deepEqual(second.metadata, {
    supportContext: {
      impersonatedUserId: "admin-b",
      impersonatedRole: "BRANCH_ADMIN",
      impersonatedBranchId: "branch-b",
    },
  });
  assert.equal(resolveAuditLogAttribution({ actorUserId: "admin-a" }).actorUserId, "admin-a");
});

test("support attribution does not replace an independently supplied customer actor", () => {
  const result = runWithAuditAttributionContext({
    impersonating: true,
    originalUserId: "support-a",
    effectiveUserId: "admin-a",
    effectiveRole: "BRANCH_ADMIN",
    effectiveBranchId: "branch-a",
  }, () => resolveAuditLogAttribution({ actorUserId: "customer-a" }));
  assert.equal(result.actorUserId, "customer-a");
});
