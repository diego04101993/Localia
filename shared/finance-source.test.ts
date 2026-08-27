import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyFinanceSource,
  isProtectedFinanceSource,
  protectedFinanceSourceValues,
} from "./finance-source";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const expectedProtectedSources = [
  "membership_assign",
  "membership_renew",
  "service_sale",
  "commercial_sale",
  "commercial_sale_cancellation",
  "sales_commission_payment",
  "lease_installment_payment",
  "fixed_expense",
  "staff_class_log",
] as const;

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("every real automatic finance source is protected", () => {
  assert.deepEqual(protectedFinanceSourceValues, expectedProtectedSources);

  for (const source of expectedProtectedSources) {
    assert.equal(isProtectedFinanceSource(source), true, source);
    assert.equal(classifyFinanceSource(source), "automatic", source);
  }
});

test("manual and legacy finance sources keep their conservative policy", () => {
  for (const source of [null, undefined, "", "   "]) {
    assert.equal(isProtectedFinanceSource(source), false);
    assert.equal(classifyFinanceSource(source), "manual");
  }

  for (const source of ["legacy_import", "custom_source", "commercial-sale"]) {
    assert.equal(isProtectedFinanceSource(source), false, source);
    assert.equal(classifyFinanceSource(source), "legacy", source);
  }
});

test("backend, storage and Caja use the shared finance source classification", () => {
  const routes = readRepositoryFile("server/routes.ts");
  const storage = readRepositoryFile("server/storage.ts");
  const caja = readRepositoryFile("client/src/components/caja-tab.tsx");

  assert.match(routes, /from "@shared\/finance-source"/);
  assert.match(storage, /from "@shared\/finance-source"/);
  assert.match(caja, /from "@shared\/finance-source"/);

  assert.doesNotMatch(routes, /AUTOMATED_FINANCE_SOURCES|RESERVED_MANUAL_FINANCE_SOURCES/);
  assert.doesNotMatch(caja, /READ_ONLY_FINANCE_SOURCES|isReadOnlyFinanceSource/);

  assert.equal((routes.match(/isProtectedFinanceSource\(/g) ?? []).length, 4);
  assert.ok((storage.match(/protectedFinanceSourceValues/g) ?? []).length >= 3);
  assert.ok((caja.match(/isProtectedFinanceSource\(/g) ?? []).length >= 4);
});
