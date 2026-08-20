BEGIN;

CREATE TABLE IF NOT EXISTS branch_lease_installment_alerts (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  lease_contract_id varchar(36) NOT NULL REFERENCES branch_lease_contracts(id),
  lease_installment_id varchar(36) NOT NULL REFERENCES branch_lease_installments(id),
  alert_kind text NOT NULL,
  due_date date NOT NULL,
  notification_id varchar(36) REFERENCES notifications(id) ON DELETE SET NULL,
  emitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_lease_installment_alerts_kind_check'
      AND conrelid = 'branch_lease_installment_alerts'::regclass
  ) THEN
    ALTER TABLE branch_lease_installment_alerts
      ADD CONSTRAINT branch_lease_installment_alerts_kind_check
      CHECK (alert_kind IN ('due_soon', 'due_today', 'overdue'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS branch_lease_installment_alerts_dedupe_unique
  ON branch_lease_installment_alerts (branch_id, lease_installment_id, alert_kind, due_date);

CREATE INDEX IF NOT EXISTS branch_lease_installment_alerts_branch_due_idx
  ON branch_lease_installment_alerts (branch_id, alert_kind, due_date);

COMMIT;
