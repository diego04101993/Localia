BEGIN;

ALTER TABLE branch_client_crm
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS medical_notes text,
  ADD COLUMN IF NOT EXISTS injuries_notes text,
  ADD COLUMN IF NOT EXISTS medical_warnings text,
  ADD COLUMN IF NOT EXISTS parq_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parq_accepted_date text,
  ADD COLUMN IF NOT EXISTS private_profile_initialized boolean NOT NULL DEFAULT false;

COMMIT;
