ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'email';

UPDATE users
SET auth_provider = 'email'
WHERE auth_provider IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique_idx
  ON users (google_id)
  WHERE google_id IS NOT NULL;
