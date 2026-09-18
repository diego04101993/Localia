BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE branch_finance_entries
ADD COLUMN IF NOT EXISTS project_id varchar(36);

DO $migration$
DECLARE
existing_definition text;
BEGIN
SELECT pg_get_constraintdef(c.oid, false)
INTO existing_definition
FROM pg_constraint c
WHERE c.conrelid = 'branch_finance_entries'::regclass
AND c.conname = 'branch_finance_entries_branch_project_fk';

IF existing_definition IS NULL THEN
ALTER TABLE branch_finance_entries
ADD CONSTRAINT branch_finance_entries_branch_project_fk
FOREIGN KEY (branch_id, project_id)
REFERENCES branch_commercial_projects(branch_id, id)
ON DELETE RESTRICT
NOT VALID;
ELSIF regexp_replace(existing_definition, '\s+', ' ', 'g')
<> 'FOREIGN KEY (branch_id, project_id) REFERENCES branch_commercial_projects(branch_id, id) ON DELETE RESTRICT' THEN
RAISE EXCEPTION
'branch_finance_entries_branch_project_fk exists with an unexpected definition: %',
existing_definition;
END IF;
END
$migration$;

ALTER TABLE branch_finance_entries
VALIDATE CONSTRAINT branch_finance_entries_branch_project_fk;

CREATE INDEX IF NOT EXISTS branch_finance_entries_branch_project_deleted_date_idx
ON branch_finance_entries (
branch_id,
project_id,
deleted_at,
entry_date DESC,
created_at DESC
)
WHERE project_id IS NOT NULL;

COMMIT;
