BEGIN;

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS tax_mode text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(8,4);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'membership_plans_tax_mode_check'
      AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
      ADD CONSTRAINT membership_plans_tax_mode_check
      CHECK (
        tax_mode IS NULL
        OR tax_mode IN ('tax_included', 'tax_added', 'tax_exempt')
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'membership_plans_tax_config_check'
      AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
      ADD CONSTRAINT membership_plans_tax_config_check
      CHECK (
        (tax_mode IS NULL AND tax_rate IS NULL)
        OR (tax_mode = 'tax_exempt' AND tax_rate = 0)
        OR (tax_mode IN ('tax_included', 'tax_added') AND tax_rate IS NOT NULL AND tax_rate > 0 AND tax_rate <= 100)
      );
  END IF;
END
$$;

ALTER TABLE branch_charge_events
  ADD COLUMN IF NOT EXISTS tax_mode text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(8,4),
  ADD COLUMN IF NOT EXISTS subtotal_before_tax_cents integer,
  ADD COLUMN IF NOT EXISTS taxable_subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS tax_total_cents integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_charge_events_tax_mode_check'
      AND conrelid = 'branch_charge_events'::regclass
  ) THEN
    ALTER TABLE branch_charge_events
      ADD CONSTRAINT branch_charge_events_tax_mode_check
      CHECK (
        tax_mode IS NULL
        OR tax_mode IN ('tax_included', 'tax_added', 'tax_exempt')
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_charge_events_tax_snapshot_nonnegative_check'
      AND conrelid = 'branch_charge_events'::regclass
  ) THEN
    ALTER TABLE branch_charge_events
      ADD CONSTRAINT branch_charge_events_tax_snapshot_nonnegative_check
      CHECK (
        (subtotal_before_tax_cents IS NULL OR subtotal_before_tax_cents >= 0)
        AND (taxable_subtotal_cents IS NULL OR taxable_subtotal_cents >= 0)
        AND (tax_total_cents IS NULL OR tax_total_cents >= 0)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_charge_events_tax_snapshot_check'
      AND conrelid = 'branch_charge_events'::regclass
  ) THEN
    ALTER TABLE branch_charge_events
      ADD CONSTRAINT branch_charge_events_tax_snapshot_check
      CHECK (
        (
          tax_mode IS NULL
          AND tax_rate IS NULL
          AND subtotal_before_tax_cents IS NULL
          AND taxable_subtotal_cents IS NULL
          AND tax_total_cents IS NULL
        )
        OR (
          tax_mode = 'tax_exempt'
          AND tax_rate = 0
          AND subtotal_before_tax_cents IS NOT NULL
          AND taxable_subtotal_cents IS NOT NULL
          AND tax_total_cents IS NOT NULL
        )
        OR (
          tax_mode IN ('tax_included', 'tax_added')
          AND tax_rate IS NOT NULL
          AND tax_rate > 0
          AND tax_rate <= 100
          AND subtotal_before_tax_cents IS NOT NULL
          AND taxable_subtotal_cents IS NOT NULL
          AND tax_total_cents IS NOT NULL
        )
      );
  END IF;
END
$$;

COMMIT;
