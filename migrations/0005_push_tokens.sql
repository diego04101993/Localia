CREATE TABLE IF NOT EXISTS push_tokens (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(36) NOT NULL REFERENCES users(id),
  token text NOT NULL,
  platform text NOT NULL,
  device_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_unique
  ON push_tokens (token);

CREATE INDEX IF NOT EXISTS push_tokens_user_active_idx
  ON push_tokens (user_id, is_active, updated_at DESC);
