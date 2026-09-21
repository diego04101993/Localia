BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE branch_sales
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint varchar(64);

ALTER TABLE branch_commission_payments
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint varchar(64);

ALTER TABLE branch_staff_class_logs
  ADD COLUMN IF NOT EXISTS operation_key varchar(120),
  ADD COLUMN IF NOT EXISTS operation_fingerprint varchar(64);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_sales'::regclass
      AND conname = 'branch_sales_idempotency_fingerprint_check'
  ) THEN
    ALTER TABLE branch_sales
      ADD CONSTRAINT branch_sales_idempotency_fingerprint_check
      CHECK (
        idempotency_fingerprint IS NULL
        OR (
          idempotency_key IS NOT NULL
          AND idempotency_fingerprint ~ '^[0-9a-f]{64}$'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_commission_payments'::regclass
      AND conname = 'branch_commission_payments_idempotency_fingerprint_check'
  ) THEN
    ALTER TABLE branch_commission_payments
      ADD CONSTRAINT branch_commission_payments_idempotency_fingerprint_check
      CHECK (
        idempotency_fingerprint IS NULL
        OR (
          idempotency_key IS NOT NULL
          AND idempotency_fingerprint ~ '^[0-9a-f]{64}$'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_staff_class_logs'::regclass
      AND conname = 'branch_staff_class_logs_operation_check'
  ) THEN
    ALTER TABLE branch_staff_class_logs
      ADD CONSTRAINT branch_staff_class_logs_operation_check
      CHECK (
        (
          operation_key IS NULL
          AND operation_fingerprint IS NULL
        )
        OR (
          operation_key IS NOT NULL
          AND operation_fingerprint IS NOT NULL
          AND char_length(operation_key) BETWEEN 8 AND 120
          AND operation_fingerprint ~ '^[0-9a-f]{64}$'
        )
      );
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS branch_staff_class_logs_branch_operation_key_unique
  ON branch_staff_class_logs (branch_id, operation_key)
  WHERE operation_key IS NOT NULL;

COMMIT;
