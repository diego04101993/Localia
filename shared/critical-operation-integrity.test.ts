import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCriticalOperationReplay,
  createCriticalOperationFingerprint,
  CriticalOperationIntegrityError,
  serializeCriticalOperationPayload,
} from "../server/critical-operation-integrity";

test("critical operation fingerprints are stable across object key order", () => {
  const first = createCriticalOperationFingerprint({
    amount: "100.00",
    nested: { method: "cash", reference: null },
    rows: [{ id: "a", quantity: 2 }],
  });
  const second = createCriticalOperationFingerprint({
    rows: [{ quantity: 2, id: "a" }],
    nested: { reference: null, method: "cash" },
    amount: "100.00",
  });

  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test("critical operation fingerprints distinguish changed payloads", () => {
  const first = createCriticalOperationFingerprint({ amount: "100.00", method: "cash" });
  const second = createCriticalOperationFingerprint({ amount: "100.01", method: "cash" });

  assert.notEqual(first, second);
});

test("critical operation serialization rejects non-finite numbers", () => {
  assert.throws(
    () => serializeCriticalOperationPayload({ amount: Number.NaN }),
    /OPERATION_FINGERPRINT_NON_FINITE_NUMBER/,
  );
});

test("critical operation replay rejects legacy and mismatched fingerprints", () => {
  const requested = createCriticalOperationFingerprint({ amount: "100.00" });

  assert.throws(
    () => assertCriticalOperationReplay(null, requested, {
      legacy: "LEGACY_CONFLICT",
      conflict: "PAYLOAD_CONFLICT",
    }),
    (error: unknown) => error instanceof CriticalOperationIntegrityError && error.code === "LEGACY_CONFLICT",
  );
  assert.throws(
    () => assertCriticalOperationReplay("f".repeat(64), requested, {
      legacy: "LEGACY_CONFLICT",
      conflict: "PAYLOAD_CONFLICT",
    }),
    (error: unknown) => error instanceof CriticalOperationIntegrityError && error.code === "PAYLOAD_CONFLICT",
  );
  assert.doesNotThrow(() => assertCriticalOperationReplay(requested, requested, {
    legacy: "LEGACY_CONFLICT",
    conflict: "PAYLOAD_CONFLICT",
  }));
});
