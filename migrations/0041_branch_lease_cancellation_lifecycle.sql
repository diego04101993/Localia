BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE branch_lease_contracts
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id varchar(36),
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_operation_key varchar(120),
  ADD COLUMN IF NOT EXISTS cancellation_fingerprint varchar(64);

DO $migration$
DECLARE
  existing_definition text;
BEGIN
  SELECT pg_get_constraintdef(c.oid, false)
  INTO existing_definition
  FROM pg_constraint c
  WHERE c.conrelid = 'branch_lease_contracts'::regclass
    AND c.conname = 'branch_lease_contracts_cancelled_by_user_fk';

  IF existing_definition IS NULL THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_cancelled_by_user_fk
      FOREIGN KEY (cancelled_by_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  ELSIF regexp_replace(existing_definition, '\s+', ' ', 'g')
    <> 'FOREIGN KEY (cancelled_by_user_id) REFERENCES users(id) ON DELETE SET NULL' THEN
    RAISE EXCEPTION
      'branch_lease_contracts_cancelled_by_user_fk exists with an unexpected definition: %',
      existing_definition;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_lease_contracts'::regclass
      AND conname = 'branch_lease_contracts_cancellation_reason_check'
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_cancellation_reason_check
      CHECK (
        cancellation_reason IS NULL
        OR char_length(btrim(cancellation_reason)) BETWEEN 3 AND 500
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'branch_lease_contracts'::regclass
      AND conname = 'branch_lease_contracts_cancellation_operation_check'
  ) THEN
    ALTER TABLE branch_lease_contracts
      ADD CONSTRAINT branch_lease_contracts_cancellation_operation_check
      CHECK (
        (
          cancellation_operation_key IS NULL
          AND cancellation_fingerprint IS NULL
        )
        OR (
          cancelled_at IS NOT NULL
          AND cancellation_reason IS NOT NULL
          AND cancellation_operation_key IS NOT NULL
          AND cancellation_fingerprint IS NOT NULL
          AND char_length(cancellation_operation_key) BETWEEN 8 AND 120
          AND cancellation_fingerprint ~ '^[0-9a-f]{64}$'
        )
      );
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS branch_lease_contracts_branch_cancellation_operation_unique
  ON branch_lease_contracts (branch_id, cancellation_operation_key)
  WHERE cancellation_operation_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS branch_lease_contracts_branch_cancelled_idx
  ON branch_lease_contracts (branch_id, cancelled_at DESC)
  WHERE cancelled_at IS NOT NULL;

COMMIT;
