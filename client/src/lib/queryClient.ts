import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getPrimaryQueryKey(queryKey: readonly unknown[]): string | null {
  return typeof queryKey[0] === "string" ? queryKey[0] : null;
}

const isDevDashboardAudit = import.meta.env.DEV;

let activeRecoveryPromise: Promise<void> | null = null;
let lastRecoveryAt = 0;
let lastSessionErrorHandledAt = 0;

function handleSessionError(status: number) {
  if (status === 401 || status === 403) {
    const now = Date.now();
    if (now - lastSessionErrorHandledAt < 1000) {
      return;
    }

    lastSessionErrorHandledAt = now;
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "AbortError")
    || String(error ?? "").includes("AbortError")
  );
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
    const contentType = res.headers.get("content-type") || "";
    let text = "";

    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => null);
      if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
        text = data.message;
      } else if (data !== null) {
        text = JSON.stringify(data);
      }
    }

    if (!text) {
      text = (await res.text()) || res.statusText;
    }

    throw new Error(`${res.status}: ${text}`);
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = (await res.text()) || "Respuesta no JSON";
    throw new Error(text);
  }

  return res.json() as Promise<T>;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: {
    signal?: AbortSignal;
  },
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: options?.signal,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export async function fetchJson<T>(
  url: string,
  options?: {
    signal?: AbortSignal;
    on401?: UnauthorizedBehavior;
  },
): Promise<T | null> {
  const res = await fetch(url, {
    credentials: "include",
    signal: options?.signal,
  });

  if (options?.on401 === "returnNull" && res.status === 401) {
    return null;
  }

  if (res.status === 403) {
    handleSessionError(403);
  }

  await throwIfResNotOk(res);
  return parseJsonResponse<T>(res);
}

export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  return async ({ queryKey, signal }) => {
    return fetchJson<T>(queryKey.join("/") as string, {
      signal,
      on401: options.on401,
    }) as Promise<T>;
  };
}

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

if (isDevDashboardAudit && typeof window !== "undefined") {
  const dashboardAuditWindow = window as typeof window & {
    __webcoolQueryAuditInstalled?: boolean;
    __webcoolActiveDashboardTab?: string;
  };

  if (!dashboardAuditWindow.__webcoolQueryAuditInstalled) {
    dashboardAuditWindow.__webcoolQueryAuditInstalled = true;
    queryClient.getQueryCache().subscribe((event) => {
      if (!event?.query) {
        return;
      }

      const primaryKey = getPrimaryQueryKey(event.query.queryKey);
      if (
        !primaryKey
        || (
          !primaryKey.startsWith("/api/branch")
          && !primaryKey.startsWith("/api/notifications")
          && primaryKey !== "/api/auth/me"
        )
      ) {
        return;
      }

      const state = event.query.state;
      if (state.status === "error") {
        if (isAbortError(state.error)) {
          return;
        }

        console.error("[dashboard-query-error]", {
          queryKey: event.query.queryKey,
          fetchStatus: state.fetchStatus,
          error:
            state.error instanceof Error
              ? state.error.message
              : String(state.error ?? "unknown"),
          activeTab: dashboardAuditWindow.__webcoolActiveDashboardTab ?? null,
          location: window.location.pathname,
        });
      }
    });
  }
}
