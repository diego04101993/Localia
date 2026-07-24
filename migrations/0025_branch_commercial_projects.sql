BEGIN;

CREATE TABLE IF NOT EXISTS branch_commercial_projects (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  customer_user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'archived')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_end_date date,
  completed_at timestamptz,
  notes text,
  created_by_user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_commercial_projects_branch_code_unique
  ON branch_commercial_projects (branch_id, code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_commercial_projects_branch_id_id_unique'
  ) THEN
    ALTER TABLE branch_commercial_projects
      ADD CONSTRAINT branch_commercial_projects_branch_id_id_unique
      UNIQUE (branch_id, id);
  END IF;
END $$;

DROP INDEX IF EXISTS branch_commercial_projects_branch_idx;
DROP INDEX IF EXISTS branch_commercial_projects_customer_idx;
DROP INDEX IF EXISTS branch_commercial_projects_status_idx;
DROP INDEX IF EXISTS branch_commercial_projects_start_date_idx;
DROP INDEX IF EXISTS branch_commercial_projects_deleted_at_idx;

CREATE INDEX IF NOT EXISTS branch_commercial_projects_branch_status_deleted_idx
  ON branch_commercial_projects (branch_id, status, deleted_at);

CREATE INDEX IF NOT EXISTS branch_commercial_projects_branch_start_date_idx
  ON branch_commercial_projects (branch_id, start_date);

CREATE INDEX IF NOT EXISTS branch_commercial_projects_branch_customer_idx
  ON branch_commercial_projects (branch_id, customer_user_id);

ALTER TABLE branch_sales
  ADD COLUMN IF NOT EXISTS project_id varchar(36);

ALTER TABLE branch_sales
  DROP CONSTRAINT IF EXISTS branch_sales_project_id_branch_commercial_projects_id_fk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_sales_branch_project_fk'
  ) THEN
    ALTER TABLE branch_sales
      ADD CONSTRAINT branch_sales_branch_project_fk
      FOREIGN KEY (branch_id, project_id)
      REFERENCES branch_commercial_projects(branch_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DROP INDEX IF EXISTS branch_sales_project_idx;

CREATE INDEX IF NOT EXISTS branch_sales_branch_project_idx
  ON branch_sales (branch_id, project_id);

CREATE INDEX IF NOT EXISTS branch_sales_branch_project_status_idx
  ON branch_sales (branch_id, project_id, status);

ALTER TABLE branch_purchases
  ADD COLUMN IF NOT EXISTS project_id varchar(36);

ALTER TABLE branch_purchases
  DROP CONSTRAINT IF EXISTS branch_purchases_project_id_branch_commercial_projects_id_fk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_purchases_branch_project_fk'
  ) THEN
    ALTER TABLE branch_purchases
      ADD CONSTRAINT branch_purchases_branch_project_fk
      FOREIGN KEY (branch_id, project_id)
      REFERENCES branch_commercial_projects(branch_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DROP INDEX IF EXISTS branch_purchases_project_idx;

CREATE INDEX IF NOT EXISTS branch_purchases_branch_project_idx
  ON branch_purchases (branch_id, project_id);

CREATE INDEX IF NOT EXISTS branch_purchases_branch_project_status_idx
  ON branch_purchases (branch_id, project_id, status);

COMMIT;
