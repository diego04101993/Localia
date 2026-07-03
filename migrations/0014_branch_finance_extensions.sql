BEGIN;

ALTER TABLE branch_finance_entries
  ALTER COLUMN source_id TYPE varchar(120);

CREATE TABLE IF NOT EXISTS branch_recurring_expenses (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'otro',
  amount numeric(12,2) NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('monthly', 'weekly', 'biweekly', 'one_time')),
  payment_day integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  last_registered_at timestamptz,
  created_by varchar(36) REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_recurring_expenses_branch_idx
  ON branch_recurring_expenses (branch_id);

CREATE INDEX IF NOT EXISTS branch_recurring_expenses_active_idx
  ON branch_recurring_expenses (is_active);

CREATE INDEX IF NOT EXISTS branch_recurring_expenses_deleted_at_idx
  ON branch_recurring_expenses (deleted_at);

CREATE TABLE IF NOT EXISTS branch_staff_members (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  name text NOT NULL,
  phone text,
  pay_per_class numeric(12,2) NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by varchar(36) REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_staff_members_branch_idx
  ON branch_staff_members (branch_id);

CREATE INDEX IF NOT EXISTS branch_staff_members_active_idx
  ON branch_staff_members (is_active);

CREATE INDEX IF NOT EXISTS branch_staff_members_deleted_at_idx
  ON branch_staff_members (deleted_at);

CREATE TABLE IF NOT EXISTS branch_staff_class_logs (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  staff_id varchar(36) NOT NULL REFERENCES branch_staff_members(id),
  classes_count integer NOT NULL CHECK (classes_count > 0),
  payment_total numeric(12,2) NOT NULL,
  class_date date NOT NULL,
  notes text,
  finance_entry_id varchar(36) REFERENCES branch_finance_entries(id),
  created_by varchar(36) REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_staff_class_logs_branch_idx
  ON branch_staff_class_logs (branch_id);

CREATE INDEX IF NOT EXISTS branch_staff_class_logs_staff_idx
  ON branch_staff_class_logs (staff_id);

CREATE INDEX IF NOT EXISTS branch_staff_class_logs_class_date_idx
  ON branch_staff_class_logs (class_date);

CREATE UNIQUE INDEX IF NOT EXISTS branch_staff_class_logs_finance_entry_unique_idx
  ON branch_staff_class_logs (finance_entry_id)
  WHERE finance_entry_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS branch_finance_entries_source_unique_idx
  ON branch_finance_entries (branch_id, source, source_id)
  WHERE deleted_at IS NULL AND source IS NOT NULL AND source_id IS NOT NULL;

COMMIT;
