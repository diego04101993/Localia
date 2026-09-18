import type { QueryClient } from "@tanstack/react-query";

const projectsUrl = "/api/branch/commercial-projects";

export function matchesExpenseProjectQuery(
  queryKey: readonly unknown[],
  projectIds: readonly (string | null | undefined)[],
): boolean {
  const url = queryKey[0];
  return typeof url === "string" && (
    url === projectsUrl
    || url.startsWith(`${projectsUrl}?`)
    || projectIds.some((id) => !!id && url === `${projectsUrl}/${id}`)
  );
}

export async function refreshExpenseProjectDetails(
  queryClient: QueryClient,
  projectIds: readonly (string | null | undefined)[],
): Promise<void> {
  const ids = Array.from(new Set(projectIds.filter((id): id is string => !!id)));
  await Promise.all(ids.map((id) => queryClient.fetchQuery({
    queryKey: [`${projectsUrl}/${id}`],
  })));
}
