BEGIN;

ALTER TABLE branch_purchases
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(120),
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint varchar(64);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_purchases'::regclass
      AND conname = 'branch_purchases_idempotency_pair_check'
  ) THEN
    ALTER TABLE branch_purchases
      ADD CONSTRAINT branch_purchases_idempotency_pair_check
      CHECK (
        (idempotency_key IS NULL AND idempotency_fingerprint IS NULL)
        OR
        (idempotency_key IS NOT NULL AND idempotency_fingerprint IS NOT NULL)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_purchases'::regclass
      AND conname = 'branch_purchases_idempotency_key_format_check'
  ) THEN
    ALTER TABLE branch_purchases
      ADD CONSTRAINT branch_purchases_idempotency_key_format_check
      CHECK (
        idempotency_key IS NULL
        OR (
          idempotency_key = btrim(idempotency_key)
          AND char_length(idempotency_key) BETWEEN 8 AND 120
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_purchases'::regclass
      AND conname = 'branch_purchases_idempotency_fingerprint_format_check'
  ) THEN
    ALTER TABLE branch_purchases
      ADD CONSTRAINT branch_purchases_idempotency_fingerprint_format_check
      CHECK (
        idempotency_fingerprint IS NULL
        OR idempotency_fingerprint ~ '^[0-9a-f]{64}$'
      ) NOT VALID;
  END IF;
END
$$;

ALTER TABLE branch_purchases
  VALIDATE CONSTRAINT branch_purchases_idempotency_pair_check;

ALTER TABLE branch_purchases
  VALIDATE CONSTRAINT branch_purchases_idempotency_key_format_check;

ALTER TABLE branch_purchases
  VALIDATE CONSTRAINT branch_purchases_idempotency_fingerprint_format_check;

CREATE UNIQUE INDEX IF NOT EXISTS branch_purchases_branch_idempotency_unique
  ON branch_purchases (branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS branch_purchases_branch_id_id_unique
  ON branch_purchases (branch_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS branch_finance_entries_branch_id_id_unique
  ON branch_finance_entries (branch_id, id);

CREATE TABLE IF NOT EXISTS branch_purchase_payments (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL,
  purchase_id varchar(36) NOT NULL,
  idempotency_key varchar(120) NOT NULL,
  idempotency_fingerprint varchar(64) NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  entry_date date NOT NULL,
  reference text,
  notes text,
  finance_entry_id varchar(36) NOT NULL,
  created_by varchar(36),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT branch_purchase_payments_branch_fk
    FOREIGN KEY (branch_id)
    REFERENCES branches(id)
    ON DELETE RESTRICT,

  CONSTRAINT branch_purchase_payments_branch_purchase_fk
    FOREIGN KEY (branch_id, purchase_id)
    REFERENCES branch_purchases(branch_id, id)
    ON DELETE RESTRICT,

  CONSTRAINT branch_purchase_payments_branch_finance_entry_fk
    FOREIGN KEY (branch_id, finance_entry_id)
    REFERENCES branch_finance_entries(branch_id, id)
    ON DELETE RESTRICT,

  CONSTRAINT branch_purchase_payments_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT branch_purchase_payments_amount_positive_check
    CHECK (amount > 0),

  CONSTRAINT branch_purchase_payments_idempotency_key_format_check
    CHECK (
      idempotency_key = btrim(idempotency_key)
      AND char_length(idempotency_key) BETWEEN 8 AND 120
    ),

  CONSTRAINT branch_purchase_payments_fingerprint_format_check
    CHECK (idempotency_fingerprint ~ '^[0-9a-f]{64}$'),

  CONSTRAINT branch_purchase_payments_payment_method_check
    CHECK (
      payment_method IN (
        'efectivo',
        'tarjeta',
        'transferencia',
        'mercado_pago',
        'otro'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_purchase_payments_branch_idempotency_unique
  ON branch_purchase_payments (branch_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS branch_purchase_payments_finance_entry_unique
  ON branch_purchase_payments (finance_entry_id);

CREATE INDEX IF NOT EXISTS branch_purchase_payments_branch_purchase_paid_idx
  ON branch_purchase_payments (branch_id, purchase_id, paid_at DESC, id);

CREATE INDEX IF NOT EXISTS branch_purchase_payments_branch_entry_date_idx
  ON branch_purchase_payments (branch_id, entry_date, created_at);

COMMIT;
