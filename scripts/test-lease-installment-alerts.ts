/**
 * Controlled one-shot validator for lease installment alerts.
 *
 * It never starts application jobs and only writes with --execute plus the
 * explicit confirmation token. The branch is fixed to the known test branch.
 *
 * Usage:
 *   npx tsx scripts/test-lease-installment-alerts.ts \
 *     --branch-id d72ad983-f074-4598-92d0-cb9a92747e56 \
 *     --installment-id <installment-id> \
 *     --today 2026-09-15 \
 *     --test-run lease-alert-20260915
 *
 * Add --execute --confirm TEST_LEASE_ALERTS to create the single test alert.
 * Add --cleanup with the same arguments to delete only an alert created by
 * this script for that exact test run.
 */

import dotenv from "dotenv";
import { getLeaseInstallmentAlertKind } from "../shared/lease-contract";

dotenv.config();

const APPROVED_TEST_BRANCH_ID = "d72ad983-f074-4598-92d0-cb9a92747e56";
const EXECUTION_CONFIRMATION = "TEST_LEASE_ALERTS";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TEST_RUN_PATTERN = /^[A-Za-z0-9_-]{3,80}$/;

type Arguments = {
  branchId: string | null;
  installmentId: string | null;
  today: string | null;
  testRunId: string | null;
  execute: boolean;
  cleanup: boolean;
  confirmation: string | null;
  help: boolean;
};

type TargetInstallment = {
  installment_id: string;
  branch_id: string;
  lease_contract_id: string;
  installment_number: number;
  due_date: string;
  payment_source: string | null;
  contract_cancelled_at: string | null;
  contract_completed_at: string | null;
  client_user_id: string | null;
  leased_item_description: string;
};

type AlertRecord = {
  alert_id: string;
  alert_kind: string;
  due_date: string;
  emitted_at: string;
  notification_id: string | null;
  notification_branch_id: string | null;
  notification_role_target: string | null;
  notification_type: string | null;
  notification_title: string | null;
  notification_data: unknown;
};

function printUsage() {
  console.log(`
Uso seguro (dry run por defecto):
  npx tsx scripts/test-lease-installment-alerts.ts \\
    --branch-id ${APPROVED_TEST_BRANCH_ID} \\
    --installment-id <uuid> \\
    --today 2026-09-15 \\
    --test-run lease-alert-20260915

Para crear una alerta de prueba:
  ... --execute --confirm ${EXECUTION_CONFIRMATION}

Para eliminar solo esa alerta de prueba:
  ... --cleanup --execute --confirm ${EXECUTION_CONFIRMATION}
`);
}

function parseArguments(argv: string[]): Arguments {
  const result: Arguments = {
    branchId: null,
    installmentId: null,
    today: null,
    testRunId: null,
    execute: false,
    cleanup: false,
    confirmation: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--branch-id") {
      result.branchId = value ?? null;
      index += 1;
    } else if (argument === "--installment-id") {
      result.installmentId = value ?? null;
      index += 1;
    } else if (argument === "--today") {
      result.today = value ?? null;
      index += 1;
    } else if (argument === "--test-run") {
      result.testRunId = value ?? null;
      index += 1;
    } else if (argument === "--confirm") {
      result.confirmation = value ?? null;
      index += 1;
    } else if (argument === "--execute") {
      result.execute = true;
    } else if (argument === "--cleanup") {
      result.cleanup = true;
    } else if (argument === "--help" || argument === "-h") {
      result.help = true;
    } else {
      throw new Error(`UNKNOWN_ARGUMENT:${argument}`);
    }
  }

  return result;
}

function requireArgument(value: string | null, name: string): string {
  if (!value?.trim()) {
    throw new Error(`${name}_REQUIRED`);
  }
  return value.trim();
}

function validateArguments(args: Arguments) {
  const branchId = requireArgument(args.branchId, "BRANCH_ID");
  const installmentId = requireArgument(args.installmentId, "INSTALLMENT_ID");
  const today = requireArgument(args.today, "TODAY");
  const testRunId = requireArgument(args.testRunId, "TEST_RUN");

  if (branchId !== APPROVED_TEST_BRANCH_ID) {
    throw new Error("TEST_BRANCH_NOT_APPROVED");
  }
  if (!ISO_DATE_PATTERN.test(today)) {
    throw new Error("TODAY_MUST_BE_YYYY_MM_DD");
  }
  if (!TEST_RUN_PATTERN.test(testRunId)) {
    throw new Error("TEST_RUN_MUST_USE_SAFE_CHARACTERS");
  }
  if (args.cleanup && !args.execute) {
    throw new Error("CLEANUP_REQUIRES_EXECUTE");
  }
  if (args.execute && args.confirmation !== EXECUTION_CONFIRMATION) {
    throw new Error("EXECUTION_CONFIRMATION_REQUIRED");
  }

  return { branchId, installmentId, today, testRunId };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("LEASE_ALERT_TEST_REFUSES_PRODUCTION_RUNTIME");
  }

  const { branchId, installmentId, today, testRunId } = validateArguments(args);
  const { assertDevelopmentDatabaseSafety } = await import("../server/runtime-safety");
  assertDevelopmentDatabaseSafety();
  const { pool } = await import("../server/db");

  try {
    const targetResult = await pool.query<TargetInstallment>(`
      SELECT
        installment.id::text AS installment_id,
        installment.branch_id::text AS branch_id,
        installment.lease_contract_id::text AS lease_contract_id,
        installment.installment_number,
        installment.due_date::text AS due_date,
        installment.payment_source::text AS payment_source,
        contract.cancelled_at::text AS contract_cancelled_at,
        contract.completed_at::text AS contract_completed_at,
        contract.client_user_id::text AS client_user_id,
        contract.leased_item_description
      FROM branch_lease_installments AS installment
      INNER JOIN branch_lease_contracts AS contract
        ON contract.id = installment.lease_contract_id
       AND contract.branch_id = installment.branch_id
      WHERE installment.id = $1
        AND installment.branch_id = $2
      LIMIT 1
    `, [installmentId, branchId]);
    const target = targetResult.rows[0];
    if (!target) {
      throw new Error("TEST_INSTALLMENT_NOT_FOUND_IN_APPROVED_BRANCH");
    }

    const expectedAlertKind = getLeaseInstallmentAlertKind(target.due_date, today);
    const isEligible = Boolean(
      expectedAlertKind
      && target.payment_source === null
      && target.contract_cancelled_at === null
      && target.contract_completed_at === null,
    );

    console.log(JSON.stringify({
      mode: args.cleanup ? "cleanup" : args.execute ? "execute" : "dry-run",
      branchId,
      installmentId: target.installment_id,
      leaseContractId: target.lease_contract_id,
      installmentNumber: target.installment_number,
      dueDate: target.due_date,
      simulatedToday: today,
      expectedAlertKind,
      paymentSource: target.payment_source,
      contractCancelled: target.contract_cancelled_at !== null,
      contractCompleted: target.contract_completed_at !== null,
      eligible: isEligible,
      testRunId,
    }, null, 2));

    if (!args.execute) {
      console.log("DRY_RUN_ONLY: no se crearon ni eliminaron alertas o notificaciones.");
      return;
    }

    if (args.cleanup) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const matchingAlerts = await client.query<{ alert_id: string; notification_id: string }>(`
          SELECT alert.id::text AS alert_id, alert.notification_id::text AS notification_id
          FROM branch_lease_installment_alerts AS alert
          INNER JOIN notifications AS notification
            ON notification.id = alert.notification_id
          WHERE alert.branch_id = $1
            AND alert.lease_installment_id = $2
            AND alert.alert_kind = $3
            AND alert.due_date = $4::date
            AND notification.branch_id = $1
            AND notification.data ->> 'leaseAlertTestRunId' = $5
          FOR UPDATE OF alert, notification
        `, [branchId, installmentId, expectedAlertKind, target.due_date, testRunId]);
        const notificationIds = matchingAlerts.rows.map((row) => row.notification_id);
        const alertIds = matchingAlerts.rows.map((row) => row.alert_id);

        if (notificationIds.length > 0) {
          await client.query(
            "DELETE FROM notifications WHERE branch_id = $1 AND id = ANY($2::varchar[])",
            [branchId, notificationIds],
          );
          await client.query(
            "DELETE FROM branch_lease_installment_alerts WHERE branch_id = $1 AND id = ANY($2::varchar[])",
            [branchId, alertIds],
          );
        }
        await client.query("COMMIT");
        console.log(JSON.stringify({
          cleanupDeletedAlerts: alertIds.length,
          cleanupDeletedNotifications: notificationIds.length,
          testRunId,
        }, null, 2));
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return;
    }

    if (!isEligible) {
      console.log("TARGET_NOT_ELIGIBLE: no se crearon alertas ni notificaciones.");
      return;
    }

    const { syncLeaseInstallmentNotifications } = await import("../server/notifications");
    const createdCount = await syncLeaseInstallmentNotifications({
      branchId,
      today,
      leaseInstallmentId: installmentId,
      testRunId,
      throwOnError: true,
    });
    const alerts = await pool.query<AlertRecord>(`
      SELECT
        alert.id::text AS alert_id,
        alert.alert_kind,
        alert.due_date::text AS due_date,
        alert.emitted_at::text AS emitted_at,
        alert.notification_id::text AS notification_id,
        notification.branch_id::text AS notification_branch_id,
        notification.role_target::text AS notification_role_target,
        notification.type AS notification_type,
        notification.title AS notification_title,
        notification.data AS notification_data
      FROM branch_lease_installment_alerts AS alert
      LEFT JOIN notifications AS notification
        ON notification.id = alert.notification_id
      WHERE alert.branch_id = $1
        AND alert.lease_installment_id = $2
        AND alert.alert_kind = $3
        AND alert.due_date = $4::date
      ORDER BY alert.created_at DESC
    `, [branchId, installmentId, expectedAlertKind, target.due_date]);
    console.log(JSON.stringify({
      createdCount,
      matchingAlertCount: alerts.rowCount,
      matchingAlerts: alerts.rows,
      expectedNotificationScope: {
        branchId,
        roleTarget: "BRANCH_ADMIN",
        notificationType: `lease_installment_${expectedAlertKind}`,
        testRunId,
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[lease-alert-test]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
