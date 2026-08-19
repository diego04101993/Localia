BEGIN;

ALTER TABLE branch_lease_contracts
  ADD COLUMN IF NOT EXISTS asset_value_cents integer,
  ADD COLUMN IF NOT EXISTS asset_subtotal_before_tax_cents integer,
  ADD COLUMN IF NOT EXISTS asset_taxable_subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS asset_tax_total_cents integer,
  ADD COLUMN IF NOT EXISTS asset_final_total_cents integer,
  ADD COLUMN IF NOT EXISTS down_payment_type text,
  ADD COLUMN IF NOT EXISTS down_payment_rate numeric(8,4),
  ADD COLUMN IF NOT EXISTS down_payment_input_cents integer,
  ADD COLUMN IF NOT EXISTS down_payment_subtotal_before_tax_cents integer,
  ADD COLUMN IF NOT EXISTS down_payment_taxable_subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS down_payment_tax_total_cents integer,
  ADD COLUMN IF NOT EXISTS down_payment_final_total_cents integer,
  ADD COLUMN IF NOT EXISTS financed_principal_before_tax_cents integer,
  ADD COLUMN IF NOT EXISTS financial_surcharge_rate numeric(8,4),
  ADD COLUMN IF NOT EXISTS financial_surcharge_total_cents integer,
  ADD COLUMN IF NOT EXISTS financed_subtotal_before_tax_cents integer,
  ADD COLUMN IF NOT EXISTS financed_taxable_subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS financed_tax_total_cents integer,
  ADD COLUMN IF NOT EXISTS financed_final_total_cents integer,
  ADD COLUMN IF NOT EXISTS contract_final_total_cents integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_down_payment_type_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_down_payment_type_check
      CHECK (
        down_payment_type IS NULL
        OR down_payment_type IN ('amount', 'percentage')
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_down_payment_shape_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_down_payment_shape_check
      CHECK (
        (
          down_payment_type IS NULL
          AND down_payment_rate IS NULL
          AND down_payment_input_cents IS NULL
        )
        OR (
          down_payment_type = 'percentage'
          AND down_payment_rate IS NOT NULL
          AND down_payment_rate >= 0
          AND down_payment_rate <= 100
          AND down_payment_input_cents IS NULL
        )
        OR (
          down_payment_type = 'amount'
          AND down_payment_input_cents IS NOT NULL
          AND down_payment_input_cents >= 0
          AND down_payment_rate IS NULL
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_contracts_financial_snapshot_nonnegative_check'
      AND conrelid = 'branch_lease_contracts'::regclass
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_financial_snapshot_nonnegative_check
      CHECK (
        (asset_value_cents IS NULL OR asset_value_cents >= 0)
        AND (asset_subtotal_before_tax_cents IS NULL OR asset_subtotal_before_tax_cents >= 0)
        AND (asset_taxable_subtotal_cents IS NULL OR asset_taxable_subtotal_cents >= 0)
        AND (asset_tax_total_cents IS NULL OR asset_tax_total_cents >= 0)
        AND (asset_final_total_cents IS NULL OR asset_final_total_cents >= 0)
        AND (down_payment_input_cents IS NULL OR down_payment_input_cents >= 0)
        AND (down_payment_subtotal_before_tax_cents IS NULL OR down_payment_subtotal_before_tax_cents >= 0)
        AND (down_payment_taxable_subtotal_cents IS NULL OR down_payment_taxable_subtotal_cents >= 0)
        AND (down_payment_tax_total_cents IS NULL OR down_payment_tax_total_cents >= 0)
        AND (down_payment_final_total_cents IS NULL OR down_payment_final_total_cents >= 0)
        AND (financed_principal_before_tax_cents IS NULL OR financed_principal_before_tax_cents >= 0)
        AND (financial_surcharge_rate IS NULL OR (financial_surcharge_rate >= 0 AND financial_surcharge_rate <= 1000))
        AND (financial_surcharge_total_cents IS NULL OR financial_surcharge_total_cents >= 0)
        AND (financed_subtotal_before_tax_cents IS NULL OR financed_subtotal_before_tax_cents >= 0)
        AND (financed_taxable_subtotal_cents IS NULL OR financed_taxable_subtotal_cents >= 0)
        AND (financed_tax_total_cents IS NULL OR financed_tax_total_cents >= 0)
        AND (financed_final_total_cents IS NULL OR financed_final_total_cents >= 0)
        AND (contract_final_total_cents IS NULL OR contract_final_total_cents >= 0)
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS branch_lease_installments (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  lease_contract_id varchar(36) NOT NULL REFERENCES branch_lease_contracts(id),
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  subtotal_before_tax_cents integer NOT NULL DEFAULT 0,
  taxable_subtotal_cents integer NOT NULL DEFAULT 0,
  tax_total_cents integer NOT NULL DEFAULT 0,
  final_total_cents integer NOT NULL DEFAULT 0,
  currency_code varchar(3) NOT NULL DEFAULT 'MXN',
  payment_source text,
  paid_at timestamptz,
  finance_entry_id varchar(36) REFERENCES branch_finance_entries(id),
  charge_event_id varchar(36) REFERENCES branch_charge_events(id),
  recorded_by_user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_installments_number_positive_check'
      AND conrelid = 'branch_lease_installments'::regclass
  ) THEN
    ALTER TABLE branch_lease_installments
      ADD CONSTRAINT branch_lease_installments_number_positive_check
      CHECK (installment_number > 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_installments_amounts_nonnegative_check'
      AND conrelid = 'branch_lease_installments'::regclass
  ) THEN
    ALTER TABLE branch_lease_installments
      ADD CONSTRAINT branch_lease_installments_amounts_nonnegative_check
      CHECK (
        subtotal_before_tax_cents >= 0
        AND taxable_subtotal_cents >= 0
        AND tax_total_cents >= 0
        AND final_total_cents >= 0
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_installments_payment_source_check'
      AND conrelid = 'branch_lease_installments'::regclass
  ) THEN
    ALTER TABLE branch_lease_installments
      ADD CONSTRAINT branch_lease_installments_payment_source_check
      CHECK (
        payment_source IS NULL
        OR payment_source IN ('webcool', 'external')
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_installments_payment_shape_check'
      AND conrelid = 'branch_lease_installments'::regclass
  ) THEN
    ALTER TABLE branch_lease_installments
      ADD CONSTRAINT branch_lease_installments_payment_shape_check
      CHECK (
        (
          payment_source IS NULL
          AND paid_at IS NULL
          AND finance_entry_id IS NULL
          AND charge_event_id IS NULL
        )
        OR (
          payment_source = 'external'
          AND finance_entry_id IS NULL
          AND charge_event_id IS NULL
        )
        OR (
          payment_source = 'webcool'
          AND paid_at IS NOT NULL
          AND finance_entry_id IS NOT NULL
          AND charge_event_id IS NOT NULL
        )
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS branch_lease_installments_branch_contract_number_unique
  ON branch_lease_installments (branch_id, lease_contract_id, installment_number);

CREATE UNIQUE INDEX IF NOT EXISTS branch_lease_installments_finance_entry_unique
  ON branch_lease_installments (finance_entry_id)
  WHERE finance_entry_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS branch_lease_installments_charge_event_unique
  ON branch_lease_installments (charge_event_id)
  WHERE charge_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS branch_lease_installments_branch_contract_due_idx
  ON branch_lease_installments (branch_id, lease_contract_id, due_date);

CREATE INDEX IF NOT EXISTS branch_lease_installments_branch_payment_source_due_idx
  ON branch_lease_installments (branch_id, payment_source, due_date);

ALTER TABLE branch_charge_events
  ADD COLUMN IF NOT EXISTS lease_installment_id varchar(36);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_charge_events_lease_installment_fk'
      AND conrelid = 'branch_charge_events'::regclass
  ) THEN
    ALTER TABLE branch_charge_events
      ADD CONSTRAINT branch_charge_events_lease_installment_fk
      FOREIGN KEY (lease_installment_id)
      REFERENCES branch_lease_installments(id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS branch_charge_events_lease_installment_unique
  ON branch_charge_events (lease_installment_id)
  WHERE lease_installment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS branch_charge_events_branch_lease_installment_charged_idx
  ON branch_charge_events (branch_id, lease_installment_id, charged_at);

COMMIT;
