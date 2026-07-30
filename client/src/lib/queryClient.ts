import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getPrimaryQueryKey(queryKey: readonly unknown[]): string | null {
  return typeof queryKey[0] === "string" ? queryKey[0] : null;
}

let activeRecoveryPromise: Promise<void> | null = null;
let lastRecoveryAt = 0;

function handleSessionError(status: number) {
  if (status === 401 || status === 403) {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }
}

export function clearScopedQueryCache() {
  queryClient.removeQueries({
    predicate: (query) => getPrimaryQueryKey(query.queryKey) !== "/api/auth/me",
  });
}

export async function recoverActiveQueriesAfterResume() {
  const now = Date.now();
  if (activeRecoveryPromise) {
    return activeRecoveryPromise;
  }

  if (now - lastRecoveryAt < 5000) {
    return;
  }

  lastRecoveryAt = now;
  activeRecoveryPromise = (async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    await queryClient.refetchQueries({
      type: "active",
      stale: true,
      predicate: (query) => getPrimaryQueryKey(query.queryKey) !== "/api/auth/me",
    });
  })().finally(() => {
    activeRecoveryPromise = null;
  });

  return activeRecoveryPromise;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    handleSessionError(res.status);
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (res.status === 403) {
      handleSessionError(403);
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 60_000,
      gcTime: 15 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
