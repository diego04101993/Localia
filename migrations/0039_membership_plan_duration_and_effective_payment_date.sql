BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS duration_unit text,
  ADD COLUMN IF NOT EXISTS duration_value integer;

ALTER TABLE branch_charge_events
  ADD COLUMN IF NOT EXISTS payment_effective_date date;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'membership_plans'::regclass
      AND conname = 'membership_plans_duration_unit_value_check'
  ) THEN
    ALTER TABLE membership_plans
      ADD CONSTRAINT membership_plans_duration_unit_value_check
      CHECK (
        (duration_unit IS NULL AND duration_value IS NULL)
        OR (
          duration_unit IS NOT NULL
          AND duration_value IS NOT NULL
          AND (
            (duration_unit = 'day' AND duration_value = 1)
            OR (duration_unit = 'week' AND duration_value BETWEEN 1 AND 156)
            OR (duration_unit = 'month' AND duration_value BETWEEN 1 AND 36)
            OR (duration_unit = 'year' AND duration_value BETWEEN 1 AND 3)
          )
        )
      ) NOT VALID;
  END IF;
END
$migration$;

ALTER TABLE membership_plans
  VALIDATE CONSTRAINT membership_plans_duration_unit_value_check;

COMMIT;
