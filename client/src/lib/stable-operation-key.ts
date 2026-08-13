import { useCallback, useRef } from "react";

type OperationAttemptState = {
  fingerprint: string;
  key: string;
  inFlight: boolean;
};

export function useStableOperationKey() {
  const attemptRef = useRef<OperationAttemptState | null>(null);

  const begin = useCallback((fingerprint: string) => {
    const current = attemptRef.current;

    if (current?.inFlight) {
      return {
        allowed: false,
        key: current.key,
      };
    }

    if (!current || current.fingerprint !== fingerprint) {
      attemptRef.current = {
        fingerprint,
        key: crypto.randomUUID(),
        inFlight: true,
      };

      return {
        allowed: true,
        key: attemptRef.current.key,
      };
    }

    attemptRef.current = {
      ...current,
      inFlight: true,
    };

    return {
      allowed: true,
      key: current.key,
    };
  }, []);

  const markError = useCallback((fingerprint: string) => {
    if (!attemptRef.current || attemptRef.current.fingerprint !== fingerprint) {
      return;
    }

    attemptRef.current = {
      ...attemptRef.current,
      inFlight: false,
    };
  }, []);

  const markSuccess = useCallback((fingerprint: string) => {
    if (!attemptRef.current || attemptRef.current.fingerprint !== fingerprint) {
      return;
    }

    attemptRef.current = null;
  }, []);

  const reset = useCallback(() => {
    attemptRef.current = null;
  }, []);

  return {
    begin,
    markError,
    markSuccess,
    reset,
  };
}
