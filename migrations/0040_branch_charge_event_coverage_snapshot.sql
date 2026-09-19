BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE branch_charge_events
  ADD COLUMN IF NOT EXISTS coverage_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS coverage_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_unit_snapshot text,
  ADD COLUMN IF NOT EXISTS duration_value_snapshot integer;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_charge_events'::regclass
      AND conname = 'branch_charge_events_coverage_snapshot_check'
  ) THEN
    ALTER TABLE branch_charge_events
      ADD CONSTRAINT branch_charge_events_coverage_snapshot_check
      CHECK (
        (
          coverage_start_at IS NULL
          AND coverage_end_at IS NULL
          AND duration_unit_snapshot IS NULL
          AND duration_value_snapshot IS NULL
        )
        OR (
          coverage_start_at IS NOT NULL
          AND coverage_end_at IS NOT NULL
          AND duration_unit_snapshot IS NOT NULL
          AND duration_value_snapshot IS NOT NULL
          AND coverage_end_at > coverage_start_at
          AND (
            (duration_unit_snapshot = 'day' AND duration_value_snapshot = 1)
            OR (duration_unit_snapshot = 'week' AND duration_value_snapshot BETWEEN 1 AND 156)
            OR (duration_unit_snapshot = 'month' AND duration_value_snapshot BETWEEN 1 AND 36)
            OR (duration_unit_snapshot = 'year' AND duration_value_snapshot BETWEEN 1 AND 3)
          )
        )
      ) NOT VALID;
  END IF;
END
$migration$;

ALTER TABLE branch_charge_events
  VALIDATE CONSTRAINT branch_charge_events_coverage_snapshot_check;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_charge_events'::regclass
      AND conname = 'branch_charge_events_membership_effective_coverage_check'
  ) THEN
    ALTER TABLE branch_charge_events
      ADD CONSTRAINT branch_charge_events_membership_effective_coverage_check
      CHECK (
        NOT (
          charge_domain = 'membership_plan'
          AND event_type IN ('assign', 'renew')
          AND payment_effective_date IS NOT NULL
        )
        OR (
          coverage_start_at IS NOT NULL
          AND coverage_end_at IS NOT NULL
          AND duration_unit_snapshot IS NOT NULL
          AND duration_value_snapshot IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END
$migration$;

ALTER TABLE branch_charge_events
  VALIDATE CONSTRAINT branch_charge_events_membership_effective_coverage_check;

COMMIT;
