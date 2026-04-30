CREATE TABLE IF NOT EXISTS branch_client_crm (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  user_id varchar(36) NOT NULL REFERENCES users(id),
  client_status text,
  last_visit timestamptz,
  tags text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_client_crm_branch_user_idx
  ON branch_client_crm(branch_id, user_id);
