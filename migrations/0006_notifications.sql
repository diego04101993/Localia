CREATE TABLE IF NOT EXISTS notifications (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id varchar(36) REFERENCES users(id),
  branch_id varchar(36) REFERENCES branches(id),
  role_target user_role,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx
  ON notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_branch_role_idx
  ON notifications (branch_id, role_target, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_role_idx
  ON notifications (role_target, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (is_read, created_at DESC);
