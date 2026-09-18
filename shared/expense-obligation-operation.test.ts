import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { matchesExpenseProjectQuery, refreshExpenseProjectDetails } from "../client/src/lib/expense-obligation-cache";
import { classifyFinanceSource } from "./finance-source";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const service = readFileSync(path.join(root, "server", "expense-obligation-storage.ts"), "utf8");
const routes = readFileSync(path.join(root, "server", "routes.ts"), "utf8");
const storage = readFileSync(path.join(root, "server", "storage.ts"), "utf8");
const migration = readFileSync(path.join(root, "migrations", "0038_branch_expense_obligations.sql"), "utf8");
const schema = readFileSync(path.join(root, "shared", "schema.ts"), "utf8");
const ui = readFileSync(path.join(root, "client", "src", "components", "gastos-cuentas-panel.tsx"), "utf8");

test("0038 and Drizzle both define the two tenant-safe tables and provider key", () => {
  for (const table of ["branch_expense_obligations", "branch_expense_obligation_payments"]) {
    assert.match(migration, new RegExp(`CREATE TABLE public\\.${table}`));
    assert.match(schema, new RegExp(`pgTable\\("${table}"`));
  }
  assert.match(schema, /branch_suppliers_branch_id_id_unique/);
  assert.match(schema, /branch_expense_obligations_tax_check/);
  assert.match(schema, /branch_expense_obligation_payments_finance_fk/);
});

test("document creation is keyed and audit plus initial payment share its transaction", () => {
  const section = service.slice(service.indexOf("export async function createExpenseObligation"), service.indexOf("export async function payExpenseObligation"));
  assert.match(section, /return db\.transaction\(async \(tx\)/);
  assert.match(section, /await lockOperation\(tx, input\.branchId, "expense-create", key\)/);
  assert.match(section, /existing\.idempotencyFingerprint !== fingerprint/);
  assert.match(section, /await insertPayment\(tx/);
  assert.match(section, /await audit\(tx/);
  assert.match(section, /originalBeneficiaryNameSnapshot/);
});

test("payment checks replay before acquiring row lock, then derives saldo under FOR UPDATE", () => {
  const section = service.slice(service.indexOf("export async function payExpenseObligation"), service.indexOf("export async function transitionExpenseObligation"));
  assert.ok(section.indexOf("if (existing)") < section.indexOf("lockDocument(tx"));
  assert.ok(section.indexOf("lockDocument(tx") < section.indexOf("paidCents(tx"));
  assert.match(service, /\.for\("update"\)/);
  assert.match(section, /assertExpensePaymentAllowed/);
  assert.match(section, /await verifyPaymentLink\(tx/);
  assert.match(section, /await audit\(tx/);
});

test("edits, cancellation and reassignment use the same locked unpaid guard", () => {
  const section = service.slice(service.indexOf("export async function transitionExpenseObligation"), service.indexOf("export async function listExpenseObligations"));
  assert.match(section, /lockDocument\(tx/);
  assert.match(section, /assertExpenseDocumentUnpaid/);
  assert.match(section, /EXPENSE_PROJECT_REASSIGN_REQUIRED/);
  assert.match(section, /await audit\(tx/);
});

test("each payment makes one protected Caja expense, but document creation without payment does not", () => {
  const artifacts = service.slice(service.indexOf("async function insertPayment"), service.indexOf("export async function createExpenseObligation"));
  assert.match(artifacts, /type: "expense"/);
  assert.match(artifacts, /source: PAYMENT_SOURCE/);
  assert.match(artifacts, /sourceId: paymentId/);
  assert.match(artifacts, /projectId: null/);
  assert.equal(classifyFinanceSource("expense_obligation_payment"), "automatic");
  assert.match(routes, /classifyFinanceSource\(existingEntry\.source\) !== "manual"/);
});

test("all new endpoints require explicit branch role and use actor branch", () => {
  const section = routes.slice(routes.indexOf("const expenseMoneySchema"), routes.indexOf('app.get("/api/branch/purchases"'));
  assert.equal((section.match(/requireBranchAdmin, requireRole\("BRANCH_ADMIN"\)/g) ?? []).length, 7);
  assert.match(section, /for \(const action of \["confirm", "cancel"\]/);
  assert.match(section, /branchId: actor\.branchId/);
  assert.doesNotMatch(section, /branchId: parsed\.data/);
});

test("the two list aggregates are independent, paginated and branch-scoped", () => {
  assert.match(service, /SUM\(\$\{branchExpenseObligationPayments\.amount\}\)/);
  assert.match(storage, /SUM\(\$\{branchExpenseObligations\.grandTotal\}\)/);
  assert.match(service, /\.limit\(pageSize\)\.offset/);
  assert.match(service, /eq\(branchExpenseObligations\.branchId, branchId\)/);
});

test("purge deletes obligation payments before Caja and documents before projects and providers", () => {
  const payments = storage.indexOf('purgePhase = "PURGE_DB_DELETE_EXPENSE_OBLIGATION_PAYMENTS"');
  const finance = storage.indexOf('purgePhase = "PURGE_DB_DELETE_FINANCE"');
  const documents = storage.indexOf('purgePhase = "PURGE_DB_DELETE_EXPENSE_OBLIGATIONS"');
  const suppliers = storage.indexOf("await tx.delete(branchSuppliers)");
  assert.ok(payments > 0 && payments < finance);
  assert.ok(documents > finance && documents < suppliers);
  assert.match(storage, /expenseObligationPayments: expenseObligationPaymentsCount/);
});

test("frontend keeps operation keys across errors and routes both entry points to one panel", () => {
  assert.match(ui, /const \[operationKey, setOperationKey\]/);
  assert.match(ui, /const \[paymentKey, setPaymentKey\]/);
  assert.match(ui, /setPaymentKey\(crypto\.randomUUID\(\)\)/);
  assert.match(ui, /entryDate: form\.initialEntryDate/);
  assert.match(ui, /entryDate: paymentEntryDate/);
  assert.doesNotMatch(ui, /entryDate: todayLocal\(\), reference: null/);
  assert.match(ui, /catch \(failure\) \{[\s\S]*setError\(errorMessage\(failure\)\)/);
  assert.match(readFileSync(path.join(root, "client", "src", "components", "caja-tab.tsx"), "utf8"), /<GastosCuentasPanel showTrigger/);
  assert.match(readFileSync(path.join(root, "client", "src", "components", "proyectos-tab.tsx"), "utf8"), /<GastosCuentasPanel open=/);
});

test("successful payments refresh inactive project details without touching unrelated projects", async () => {
  let revision = 1;
  let fetches = 0;
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        queryFn: async () => {
          fetches++;
          return { revision };
        },
      },
    },
  });
  const projectKey = (id: string) => [`/api/branch/commercial-projects/${id}`];
  await Promise.all(["old", "new", "unrelated"].map((id) => client.prefetchQuery({ queryKey: projectKey(id) })));
  revision = 2;
  await client.invalidateQueries({ predicate: (query) => matchesExpenseProjectQuery(query.queryKey, ["old", "new"]) });
  assert.equal(fetches, 3);

  await refreshExpenseProjectDetails(client, ["old", "new", "old", null]);
  assert.equal(fetches, 5);
  assert.deepEqual(client.getQueryData(projectKey("old")), { revision: 2 });
  assert.deepEqual(client.getQueryData(projectKey("new")), { revision: 2 });
  assert.deepEqual(client.getQueryData(projectKey("unrelated")), { revision: 1 });
  assert.equal(matchesExpenseProjectQuery(["/api/branch/commercial-projects?page=1"], ["old"]), true);
  assert.equal(matchesExpenseProjectQuery(["/api/branch/commercial-projects/options"], ["old"]), false);
  assert.equal(matchesExpenseProjectQuery(projectKey("unrelated"), ["old"]), false);
  assert.match(ui, /await synchronize\(\[detailQuery\.data\?\.projectId, saved\.projectId\]\)/);
  assert.match(ui, /await synchronize\(\[detailQuery\.data\?\.projectId, projectChoice \|\| null\]\)/);
  assert.match(ui, /queryClient\.invalidateQueries\(\{ predicate: \(query\) => matchesExpenseProjectQuery\(query\.queryKey, projectIds\)/);
  assert.match(ui, /invalidateBranchFinanceQueries\(\)/);
  assert.doesNotMatch(ui, /invalidateBranchCommercialQueries/);
});
