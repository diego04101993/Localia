BEGIN;

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS lease_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_lease_term_months integer,
  ADD COLUMN IF NOT EXISTS default_leased_item_description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'membership_plans_default_lease_term_positive_check'
      AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
      ADD CONSTRAINT membership_plans_default_lease_term_positive_check
      CHECK (
        default_lease_term_months IS NULL
        OR default_lease_term_months > 0
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'membership_plans_lease_template_check'
      AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
      ADD CONSTRAINT membership_plans_lease_template_check
      CHECK (
        (lease_enabled = false AND default_lease_term_months IS NULL)
        OR (
          lease_enabled = true
          AND cycle_months = 1
          AND default_lease_term_months IS NOT NULL
          AND default_lease_term_months > 0
        )
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS branch_lease_contracts (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  membership_id varchar(36) REFERENCES memberships(id) ON DELETE SET NULL,
  client_user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  plan_id varchar(36) REFERENCES membership_plans(id) ON DELETE SET NULL,
  contract_start_date date NOT NULL,
  contract_end_date date NOT NULL,
  contract_term_months integer NOT NULL,
  pre_webcool_paid_installments integer NOT NULL DEFAULT 0,
  leased_item_description text NOT NULL,
  notes text,
  captured_price_cents integer NOT NULL DEFAULT 0,
  tax_mode_snapshot text,
  tax_rate_snapshot numeric(8,4),
  monthly_subtotal_before_tax_cents integer,
  monthly_taxable_subtotal_cents integer,
  monthly_tax_total_cents integer,
  monthly_final_total_cents integer NOT NULL DEFAULT 0,
  currency_code varchar(3) NOT NULL DEFAULT 'MXN',
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_term_positive_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_term_positive_check
      CHECK (contract_term_months > 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_prepaid_range_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_prepaid_range_check
      CHECK (
        pre_webcool_paid_installments >= 0
        AND pre_webcool_paid_installments <= contract_term_months
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_end_not_before_start_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_end_not_before_start_check
      CHECK (contract_end_date >= contract_start_date);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_single_terminal_state_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_single_terminal_state_check
      CHECK (
        cancelled_at IS NULL
        OR completed_at IS NULL
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_tax_mode_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_tax_mode_check
      CHECK (
        tax_mode_snapshot IS NULL
        OR tax_mode_snapshot IN ('tax_included', 'tax_added', 'tax_exempt')
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_snapshot_nonnegative_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_snapshot_nonnegative_check
      CHECK (
        captured_price_cents >= 0
        AND monthly_final_total_cents >= 0
        AND (monthly_subtotal_before_tax_cents IS NULL OR monthly_subtotal_before_tax_cents >= 0)
        AND (monthly_taxable_subtotal_cents IS NULL OR monthly_taxable_subtotal_cents >= 0)
        AND (monthly_tax_total_cents IS NULL OR monthly_tax_total_cents >= 0)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_tax_snapshot_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_tax_snapshot_check
      CHECK (
        (
          tax_mode_snapshot IS NULL
          AND tax_rate_snapshot IS NULL
          AND monthly_subtotal_before_tax_cents IS NULL
          AND monthly_taxable_subtotal_cents IS NULL
          AND monthly_tax_total_cents IS NULL
        )
        OR (
          tax_mode_snapshot = 'tax_exempt'
          AND tax_rate_snapshot = 0
          AND monthly_subtotal_before_tax_cents IS NOT NULL
          AND monthly_taxable_subtotal_cents IS NOT NULL
          AND monthly_tax_total_cents IS NOT NULL
        )
        OR (
          tax_mode_snapshot IN ('tax_included', 'tax_added')
          AND tax_rate_snapshot IS NOT NULL
          AND tax_rate_snapshot > 0
          AND tax_rate_snapshot <= 100
          AND monthly_subtotal_before_tax_cents IS NOT NULL
          AND monthly_taxable_subtotal_cents IS NOT NULL
          AND monthly_tax_total_cents IS NOT NULL
        )
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS branch_lease_contracts_open_membership_unique
  ON branch_lease_contracts (branch_id, membership_id)
  WHERE membership_id IS NOT NULL
    AND cancelled_at IS NULL
    AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS branch_lease_contracts_branch_membership_created_idx
  ON branch_lease_contracts (branch_id, membership_id, created_at);

CREATE INDEX IF NOT EXISTS branch_lease_contracts_branch_client_created_idx
  ON branch_lease_contracts (branch_id, client_user_id, created_at);

CREATE INDEX IF NOT EXISTS branch_lease_contracts_branch_plan_created_idx
  ON branch_lease_contracts (branch_id, plan_id, created_at);

CREATE INDEX IF NOT EXISTS branch_lease_contracts_branch_open_end_date_idx
  ON branch_lease_contracts (branch_id, contract_end_date)
  WHERE cancelled_at IS NULL
    AND completed_at IS NULL;

ALTER TABLE branch_charge_events
  ADD COLUMN IF NOT EXISTS lease_contract_id varchar(36);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_charge_events_lease_contract_fk'
      AND conrelid = 'branch_charge_events'::regclass
  ) THEN
    ALTER TABLE branch_charge_events
      ADD CONSTRAINT branch_charge_events_lease_contract_fk
      FOREIGN KEY (lease_contract_id)
      REFERENCES branch_lease_contracts(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS branch_charge_events_branch_lease_contract_charged_idx
  ON branch_charge_events (branch_id, lease_contract_id, charged_at);

COMMIT;
