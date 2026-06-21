ALTER TABLE users
  ADD COLUMN IF NOT EXISTS firebase_uid text;

CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_unique_idx
  ON users (firebase_uid)
  WHERE firebase_uid IS NOT NULL;
