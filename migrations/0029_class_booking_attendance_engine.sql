BEGIN;

ALTER TABLE class_bookings
  ADD COLUMN IF NOT EXISTS class_consumed boolean;

ALTER TABLE class_bookings
  ADD COLUMN IF NOT EXISTS class_consumed_at timestamptz;

ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS booking_id varchar(36);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class tbl
      ON tbl.oid = c.conrelid
    JOIN pg_namespace ns
      ON ns.oid = tbl.relnamespace
    WHERE c.conname = 'attendances_booking_id_fkey'
      AND tbl.relname = 'attendances'
      AND ns.nspname = current_schema()
  ) THEN
    ALTER TABLE attendances
      ADD CONSTRAINT attendances_booking_id_fkey
      FOREIGN KEY (booking_id)
      REFERENCES class_bookings(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS attendances_booking_id_unique
  ON attendances (booking_id)
  WHERE booking_id IS NOT NULL;

UPDATE class_bookings AS cb
SET
  class_consumed = false,
  class_consumed_at = NULL
FROM class_schedules AS cs
WHERE cb.class_consumed IS NULL
  AND cb.status = 'confirmed'
  AND cb.class_schedule_id = cs.id
  AND (
    cb.booking_date > ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City')::date)::text
    OR (
      cb.booking_date = ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City')::date)::text
      AND cs.start_time >= to_char(CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City', 'HH24:MI')
    )
  );

CREATE OR REPLACE FUNCTION set_class_booking_engine_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND NEW.class_consumed IS NULL THEN
    NEW.class_consumed := false;
    NEW.class_consumed_at := NULL;
  END IF;

  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'class_bookings_engine_defaults_trigger'
      AND tgrelid = 'class_bookings'::regclass
  ) THEN
    CREATE TRIGGER class_bookings_engine_defaults_trigger
      BEFORE INSERT ON class_bookings
      FOR EACH ROW
      EXECUTE FUNCTION set_class_booking_engine_defaults();
  END IF;
END
$$;

COMMIT;
