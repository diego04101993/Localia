import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

type AuditAttributionContext = {
  impersonating: boolean;
  originalUserId: string | null;
  effectiveUserId: string | null;
  effectiveRole: string | null;
  effectiveBranchId: string | null;
};

type AuditLogInput = {
  actorUserId: string;
  metadata?: unknown;
};

const auditAttributionStorage = new AsyncLocalStorage<AuditAttributionContext>();

export function runWithAuditAttributionContext<T>(
  context: AuditAttributionContext,
  work: () => T,
): T {
  return auditAttributionStorage.run(context, work);
}

export function auditAttributionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const session = req.session as any;
  const effectiveUser = req.user as any;
  const impersonating = Boolean(session?.impersonating && session?.originalUserId);

  runWithAuditAttributionContext({
    impersonating,
    originalUserId: impersonating ? String(session.originalUserId) : null,
    effectiveUserId: effectiveUser?.id ? String(effectiveUser.id) : null,
    effectiveRole: effectiveUser?.role ? String(effectiveUser.role) : null,
    effectiveBranchId: effectiveUser?.branchId ? String(effectiveUser.branchId) : null,
  }, next);
}

export function resolveAuditLogAttribution<T extends AuditLogInput>(data: T): T {
  const context = auditAttributionStorage.getStore();
  if (
    !context?.impersonating
    || !context.originalUserId
    || !context.effectiveUserId
    || data.actorUserId !== context.effectiveUserId
  ) {
    return data;
  }

  const existingMetadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
    ? data.metadata as Record<string, unknown>
    : {};

  return {
    ...data,
    actorUserId: context.originalUserId,
    metadata: {
      ...existingMetadata,
      supportContext: {
        impersonatedUserId: context.effectiveUserId,
        impersonatedRole: context.effectiveRole,
        impersonatedBranchId: context.effectiveBranchId,
      },
    },
  };
}
