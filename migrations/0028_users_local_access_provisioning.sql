BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS local_access_provisioned_at timestamptz NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS local_access_provisioned_by_branch_id varchar(36) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_local_access_provisioned_by_branch_id_fkey'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_local_access_provisioned_by_branch_id_fkey
      FOREIGN KEY (local_access_provisioned_by_branch_id)
      REFERENCES branches(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

COMMIT;
