BEGIN;

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT
      ns.nspname AS schema_name,
      tbl.relname AS table_name,
      c.conname AS constraint_name
    FROM pg_constraint c
    JOIN pg_class tbl
      ON tbl.oid = c.conrelid
    JOIN pg_namespace ns
      ON ns.oid = tbl.relnamespace
    WHERE c.contype = 'u'
      AND ns.nspname = current_schema()
      AND tbl.relname = 'users'
      AND array_length(c.conkey, 1) = 1
      AND (
        SELECT att.attname
        FROM pg_attribute att
        WHERE att.attrelid = tbl.oid
          AND att.attnum = c.conkey[1]
      ) = 'email'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      rec.schema_name,
      rec.table_name,
      rec.constraint_name
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT
      ns.nspname AS schema_name,
      idx.relname AS index_name
    FROM pg_index i
    JOIN pg_class idx
      ON idx.oid = i.indexrelid
    JOIN pg_class tbl
      ON tbl.oid = i.indrelid
    JOIN pg_namespace ns
      ON ns.oid = tbl.relnamespace
    LEFT JOIN pg_constraint c
      ON c.conindid = i.indexrelid
    JOIN pg_attribute a
      ON a.attrelid = tbl.oid
     AND a.attnum = ANY(i.indkey)
    WHERE tbl.relname = 'users'
      AND ns.nspname = current_schema()
      AND i.indisunique
      AND c.oid IS NULL
      AND i.indnkeyatts = 1
      AND i.indexprs IS NULL
      AND a.attname = 'email'
      AND idx.relname <> 'users_email_normalized_unique'
  LOOP
    EXECUTE format(
      'DROP INDEX IF EXISTS %I.%I',
      rec.schema_name,
      rec.index_name
    );
  END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique
  ON users ((lower(btrim(email))))
  WHERE email IS NOT NULL
    AND btrim(email) <> '';

COMMIT;
