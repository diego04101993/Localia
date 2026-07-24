BEGIN;

ALTER TABLE branch_sales
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(120);

CREATE UNIQUE INDEX IF NOT EXISTS branch_sales_branch_idempotency_unique
  ON branch_sales (branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE branch_commission_payments
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(120);

CREATE UNIQUE INDEX IF NOT EXISTS branch_commission_payments_branch_idempotency_unique
  ON branch_commission_payments (branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS branch_finance_entries_branch_source_source_id_active_unique
  ON branch_finance_entries (branch_id, source, source_id)
  WHERE source IS NOT NULL
    AND source_id IS NOT NULL
    AND deleted_at IS NULL;

COMMIT;
