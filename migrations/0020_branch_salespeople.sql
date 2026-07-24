BEGIN;

CREATE TABLE IF NOT EXISTS branch_salespeople (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  last_name text,
  phone text,
  email text,
  employee_code text,
  role_label text,
  monthly_goal_amount numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_salespeople_branch_idx
  ON branch_salespeople (branch_id);

CREATE INDEX IF NOT EXISTS branch_salespeople_active_idx
  ON branch_salespeople (is_active);

CREATE INDEX IF NOT EXISTS branch_salespeople_user_idx
  ON branch_salespeople (user_id);

CREATE INDEX IF NOT EXISTS branch_salespeople_deleted_at_idx
  ON branch_salespeople (deleted_at);

CREATE INDEX IF NOT EXISTS branch_salespeople_name_idx
  ON branch_salespeople (name);

ALTER TABLE branch_sales
  ADD COLUMN IF NOT EXISTS seller_id varchar(36) REFERENCES branch_salespeople(id) ON DELETE SET NULL;

ALTER TABLE branch_sales
  ADD COLUMN IF NOT EXISTS seller_name_snapshot text;

ALTER TABLE branch_sales
  ADD COLUMN IF NOT EXISTS seller_metadata jsonb;

CREATE INDEX IF NOT EXISTS branch_sales_seller_idx
  ON branch_sales (seller_id);

COMMIT;
