import { queryClient } from "@/lib/queryClient";

function matchesQueryPrefix(queryKey: readonly unknown[], prefix: string) {
  return typeof queryKey[0] === "string" && queryKey[0].startsWith(prefix);
}

export function invalidateBranchFinanceQueries() {
  return queryClient.invalidateQueries({
    predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/finance/"),
  });
}

export function invalidateBranchCommercialQueries(options?: {
  clientId?: string | null;
  productId?: string | null;
  purchaseId?: string | null;
  projectId?: string | null;
  salespersonId?: string | null;
  supplierId?: string | null;
  saleId?: string | null;
  commissionPaymentId?: string | null;
}) {
  const invalidations: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: ["/api/branch/commercial-dashboard"] }),
    queryClient.invalidateQueries({
      predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/salespeople"),
    }),
    queryClient.invalidateQueries({
      predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/commercial-products"),
    }),
    queryClient.invalidateQueries({
      predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/purchases"),
    }),
    queryClient.invalidateQueries({
      predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/commercial-projects"),
    }),
    queryClient.invalidateQueries({
      predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/suppliers"),
    }),
    queryClient.invalidateQueries({
      predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/sales/"),
    }),
    queryClient.invalidateQueries({
      predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/commission-payments/"),
    }),
    queryClient.invalidateQueries({
      predicate: (query) => typeof query.queryKey[0] === "string" && (query.queryKey[0] as string).startsWith("/api/notifications"),
    }),
  ];

  if (options?.clientId) {
    invalidations.push(
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string"
          && (query.queryKey[0] as string).startsWith(`/api/branch/clients/${options.clientId}/commercial-history`),
      }),
    );
  }

  if (options?.productId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: [`/api/branch/commercial-products/${options.productId}/performance`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/branch/commercial-products/${options.productId}/inventory`] }),
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string"
          && (query.queryKey[0] as string).startsWith(`/api/branch/commercial-products/${options.productId}/inventory/movements`),
      }),
    );
  }

  if (options?.salespersonId) {
    invalidations.push(
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string"
          && (query.queryKey[0] as string).startsWith(`/api/branch/salespeople/${options.salespersonId}/`),
      }),
    );
  }

  if (options?.supplierId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: [`/api/branch/suppliers/${options.supplierId}/summary`] }),
    );
  }

  if (options?.purchaseId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: [`/api/branch/purchases/${options.purchaseId}`] }),
    );
  }

  if (options?.projectId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: [`/api/branch/commercial-projects/${options.projectId}`] }),
    );
  }

  if (options?.saleId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: [`/api/branch/sales/${options.saleId}`] }),
    );
  }

  if (options?.commissionPaymentId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: [`/api/branch/commission-payments/${options.commissionPaymentId}`] }),
    );
  }

  return Promise.all(invalidations);
}

export function invalidateBranchClientQueries(clientId?: string | null) {
  const invalidations: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] }),
  ];

  if (clientId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] }));
  }

  return Promise.all(invalidations);
}

export function invalidateBranchMembershipQueries(clientId?: string | null) {
  return Promise.all([
    invalidateBranchClientQueries(clientId),
    queryClient.invalidateQueries({ queryKey: ["/api/branch/alerts"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/branch/stats"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/branch/dashboard-metrics"] }),
    invalidateBranchFinanceQueries(),
  ]);
}

export function invalidateBranchRecurringExpenseQueries() {
  return Promise.all([
    invalidateBranchFinanceQueries(),
    queryClient.invalidateQueries({ queryKey: ["/api/branch/finance/fixed-expenses"] }),
  ]);
}

export function invalidateBranchStaffQueries() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/branch/finance/staff"] }),
    queryClient.invalidateQueries({
      predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/finance/staff/class-logs"),
    }),
  ]);
}

export function invalidateBranchStaffFinanceQueries() {
  return Promise.all([
    invalidateBranchFinanceQueries(),
    invalidateBranchStaffQueries(),
  ]);
}
