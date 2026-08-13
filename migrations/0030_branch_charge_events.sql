BEGIN;

CREATE TABLE IF NOT EXISTS branch_charge_events (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  charge_domain text NOT NULL,
  event_type text NOT NULL,
  operation_key varchar(120) NOT NULL,
  membership_id varchar(36) REFERENCES memberships(id) ON DELETE SET NULL,
  plan_id varchar(36) REFERENCES membership_plans(id) ON DELETE SET NULL,
  client_user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  finance_entry_id varchar(36) REFERENCES branch_finance_entries(id) ON DELETE SET NULL,
  plan_name_snapshot text NOT NULL,
  base_price_cents integer NOT NULL DEFAULT 0 CHECK (base_price_cents >= 0),
  final_total_cents integer NOT NULL DEFAULT 0 CHECK (final_total_cents >= 0),
  currency_code varchar(3) NOT NULL DEFAULT 'MXN',
  charged_at timestamptz NOT NULL DEFAULT now(),
  snapshot_version integer NOT NULL DEFAULT 1,
  context_json jsonb,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_charge_events_charge_domain_check
    CHECK (charge_domain IN ('membership_plan')),
  CONSTRAINT branch_charge_events_event_type_check
    CHECK (event_type IN ('assign', 'renew')),
  CONSTRAINT branch_charge_events_branch_operation_key_unique
    UNIQUE (branch_id, operation_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_charge_events_finance_entry_unique
  ON branch_charge_events (finance_entry_id)
  WHERE finance_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS branch_charge_events_branch_membership_created_idx
  ON branch_charge_events (branch_id, membership_id, created_at);

CREATE INDEX IF NOT EXISTS branch_charge_events_branch_client_charged_idx
  ON branch_charge_events (branch_id, client_user_id, charged_at);

CREATE INDEX IF NOT EXISTS branch_charge_events_branch_domain_event_charged_idx
  ON branch_charge_events (branch_id, charge_domain, event_type, charged_at);

COMMIT;
