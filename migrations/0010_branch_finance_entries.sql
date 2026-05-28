CREATE TABLE IF NOT EXISTS branch_finance_entries (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  type text NOT NULL,
  category text,
  concept text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  payment_method text,
  client_user_id varchar(36) REFERENCES users(id),
  client_name text,
  notes text,
  entry_date date NOT NULL,
  source text,
  source_id varchar(36),
  metadata jsonb,
  created_by varchar(36) REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_finance_entries_branch_idx
  ON branch_finance_entries (branch_id);

CREATE INDEX IF NOT EXISTS branch_finance_entries_entry_date_idx
  ON branch_finance_entries (entry_date);

CREATE INDEX IF NOT EXISTS branch_finance_entries_type_idx
  ON branch_finance_entries (type);

CREATE INDEX IF NOT EXISTS branch_finance_entries_deleted_at_idx
  ON branch_finance_entries (deleted_at);

CREATE INDEX IF NOT EXISTS branch_finance_entries_client_user_idx
  ON branch_finance_entries (client_user_id);
