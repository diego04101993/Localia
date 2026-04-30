CREATE TABLE IF NOT EXISTS system_events (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  branch_id varchar(36) REFERENCES branches(id),
  user_id varchar(36) REFERENCES users(id),
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS system_events_created_at_idx
  ON system_events (created_at DESC);

CREATE INDEX IF NOT EXISTS system_events_status_idx
  ON system_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS system_events_branch_idx
  ON system_events (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS system_events_user_idx
  ON system_events (user_id, created_at DESC);
