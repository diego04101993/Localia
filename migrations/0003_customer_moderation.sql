ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_by varchar(36);

ALTER TABLE branch_reviews
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_report_status') THEN
    CREATE TYPE customer_report_status AS ENUM ('pending', 'reviewed', 'dismissed', 'escalated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS branch_customer_blocks (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  user_id varchar(36) NOT NULL REFERENCES users(id),
  blocked_by_user_id varchar(36) NOT NULL REFERENCES users(id),
  reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  unblocked_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_customer_blocks_branch_user_idx
  ON branch_customer_blocks (branch_id, user_id);

CREATE INDEX IF NOT EXISTS branch_customer_blocks_active_idx
  ON branch_customer_blocks (branch_id, user_id, unblocked_at);

CREATE TABLE IF NOT EXISTS customer_reports (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  user_id varchar(36) NOT NULL REFERENCES users(id),
  reported_by_user_id varchar(36) NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  note text,
  status customer_report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by_user_id varchar(36) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS customer_reports_branch_idx
  ON customer_reports (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS customer_reports_user_idx
  ON customer_reports (user_id, created_at DESC);
