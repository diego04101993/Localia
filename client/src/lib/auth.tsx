import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  queryClient,
  apiRequest,
  getQueryFn,
  clearScopedQueryCache,
  recoverActiveQueriesAfterResume,
} from "./queryClient";
import type { User } from "@shared/schema";

type AuthUser = Omit<User, "passwordHash"> & {
  branch?: { id: string; name: string; slug: string; status: string } | null;
  acceptedTerms?: boolean;
  emailVerified?: boolean;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, refetch } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const hasInitializedAuthScopeRef = useRef(false);
  const previousScopeRef = useRef<string | null>(null);
  const authScope = useMemo(() => {
    if (!user) return "guest";
    return [
      user.id,
      user.role,
      user.branch?.id ?? "no-branch",
      (user as any).impersonating ? "impersonating" : "direct",
    ].join(":");
  }, [user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!hasInitializedAuthScopeRef.current) {
      previousScopeRef.current = authScope;
      hasInitializedAuthScopeRef.current = true;
      return;
    }

    if (previousScopeRef.current !== authScope) {
      clearScopedQueryCache();
      previousScopeRef.current = authScope;
    }
  }, [authScope, isLoading]);

  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void recoverActiveQueriesAfterResume();
      }
    };

    const handlePageShow = () => {
      void recoverActiveQueriesAfterResume();
    };

    const handleOnline = () => {
      void recoverActiveQueriesAfterResume();
    };

    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await apiRequest("POST", "/api/auth/login", { email, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    [loginMutation]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, logout, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
