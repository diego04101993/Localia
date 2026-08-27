import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("server runtime has no age-based branch finance cleanup", () => {
  const serverDirectory = path.join(repositoryRoot, "server");
  const offenders = readdirSync(serverDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .filter((entry) => readFileSync(path.join(serverDirectory, entry.name), "utf8")
      .includes("cleanupOldBranchFinanceEntries"))
    .map((entry) => entry.name);

  assert.deepEqual(offenders, []);
});

test("unrelated startup and background maintenance remains enabled", () => {
  assert.match(readRepositoryFile("server/index.ts"), /createNotificationCleanupJob\(\)/);
  assert.match(readRepositoryFile("server/notifications.ts"), /cleanupOldNotifications\(maxAgeDays\)/);
  assert.match(readRepositoryFile("server/routes.ts"), /storage\.reconcilePastBookings\(branchId\)/);
  assert.match(readRepositoryFile("server/routes.ts"), /syncLeaseInstallmentNotifications\(\{ branchId \}\)/);
});
