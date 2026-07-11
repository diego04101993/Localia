import { queryClient } from "@/lib/queryClient";

function matchesQueryPrefix(queryKey: readonly unknown[], prefix: string) {
  return typeof queryKey[0] === "string" && queryKey[0].startsWith(prefix);
}

export function invalidateBranchFinanceQueries() {
  return queryClient.invalidateQueries({
    predicate: (query) => matchesQueryPrefix(query.queryKey, "/api/branch/finance/"),
  });
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
