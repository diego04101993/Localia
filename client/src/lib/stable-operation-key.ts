import { useCallback, useRef } from "react";

export type OperationAttemptState = {
  fingerprint: string;
  key: string;
  inFlight: boolean;
};

export function beginStableOperationAttempt(
  current: OperationAttemptState | null,
  fingerprint: string,
  createKey: () => string = () => crypto.randomUUID(),
): {
  state: OperationAttemptState;
  attempt: { allowed: boolean; key: string };
} {
  if (current?.inFlight) {
    return {
      state: current,
      attempt: { allowed: false, key: current.key },
    };
  }

  const state = !current || current.fingerprint !== fingerprint
    ? { fingerprint, key: createKey(), inFlight: true }
    : { ...current, inFlight: true };

  return {
    state,
    attempt: { allowed: true, key: state.key },
  };
}

export function markStableOperationError(
  current: OperationAttemptState | null,
  fingerprint: string,
): OperationAttemptState | null {
  if (!current || current.fingerprint !== fingerprint) return current;
  return { ...current, inFlight: false };
}

export function markStableOperationSuccess(
  current: OperationAttemptState | null,
  fingerprint: string,
): OperationAttemptState | null {
  if (!current || current.fingerprint !== fingerprint) return current;
  return null;
}

export function useStableOperationKey() {
  const attemptRef = useRef<OperationAttemptState | null>(null);

  const begin = useCallback((fingerprint: string) => {
    const next = beginStableOperationAttempt(attemptRef.current, fingerprint);
    attemptRef.current = next.state;
    return next.attempt;
  }, []);

  const markError = useCallback((fingerprint: string) => {
    attemptRef.current = markStableOperationError(attemptRef.current, fingerprint);
  }, []);

  const markSuccess = useCallback((fingerprint: string) => {
    attemptRef.current = markStableOperationSuccess(attemptRef.current, fingerprint);
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
