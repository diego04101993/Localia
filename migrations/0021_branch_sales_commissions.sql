BEGIN;

CREATE TABLE IF NOT EXISTS branch_commission_rules (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  salesperson_id varchar(36) NOT NULL REFERENCES branch_salespeople(id),
  name text NOT NULL,
  rule_type text NOT NULL,
  percentage_rate numeric(8,4),
  fixed_amount numeric(12,2),
  commercial_product_id varchar(36) REFERENCES branch_commercial_products(id) ON DELETE SET NULL,
  category text,
  minimum_goal_amount numeric(12,2),
  bonus_amount numeric(12,2),
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_until date,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_commission_rules_branch_idx
  ON branch_commission_rules (branch_id);

CREATE INDEX IF NOT EXISTS branch_commission_rules_salesperson_idx
  ON branch_commission_rules (salesperson_id);

CREATE INDEX IF NOT EXISTS branch_commission_rules_active_idx
  ON branch_commission_rules (is_active);

CREATE INDEX IF NOT EXISTS branch_commission_rules_deleted_at_idx
  ON branch_commission_rules (deleted_at);

CREATE INDEX IF NOT EXISTS branch_commission_rules_type_idx
  ON branch_commission_rules (rule_type);

CREATE INDEX IF NOT EXISTS branch_commission_rules_product_idx
  ON branch_commission_rules (commercial_product_id);

CREATE TABLE IF NOT EXISTS branch_commission_accruals (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  salesperson_id varchar(36) NOT NULL REFERENCES branch_salespeople(id),
  sale_id varchar(36) REFERENCES branch_sales(id) ON DELETE SET NULL,
  sale_item_id varchar(36) REFERENCES branch_sale_items(id) ON DELETE SET NULL,
  commission_rule_id varchar(36) REFERENCES branch_commission_rules(id) ON DELETE SET NULL,
  accrual_type text NOT NULL DEFAULT 'sale',
  reference_key text NOT NULL,
  period_month text,
  status text NOT NULL DEFAULT 'approved',
  base_amount numeric(12,2) NOT NULL DEFAULT 0,
  rate_snapshot numeric(8,4),
  fixed_amount_snapshot numeric(12,2),
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  salesperson_name_snapshot text NOT NULL,
  rule_name_snapshot text,
  calculation_snapshot jsonb,
  accrued_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_commission_accruals_branch_reference_unique
  ON branch_commission_accruals (branch_id, reference_key);

CREATE INDEX IF NOT EXISTS branch_commission_accruals_branch_idx
  ON branch_commission_accruals (branch_id);

CREATE INDEX IF NOT EXISTS branch_commission_accruals_salesperson_idx
  ON branch_commission_accruals (salesperson_id);

CREATE INDEX IF NOT EXISTS branch_commission_accruals_sale_idx
  ON branch_commission_accruals (sale_id);

CREATE INDEX IF NOT EXISTS branch_commission_accruals_status_idx
  ON branch_commission_accruals (status);

CREATE INDEX IF NOT EXISTS branch_commission_accruals_accrued_at_idx
  ON branch_commission_accruals (accrued_at);

CREATE INDEX IF NOT EXISTS branch_commission_accruals_period_month_idx
  ON branch_commission_accruals (period_month);

CREATE TABLE IF NOT EXISTS branch_commission_payments (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  salesperson_id varchar(36) NOT NULL REFERENCES branch_salespeople(id),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  reference text,
  notes text,
  period_start date,
  period_end date,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_commission_payments_branch_idx
  ON branch_commission_payments (branch_id);

CREATE INDEX IF NOT EXISTS branch_commission_payments_salesperson_idx
  ON branch_commission_payments (salesperson_id);

CREATE INDEX IF NOT EXISTS branch_commission_payments_paid_at_idx
  ON branch_commission_payments (paid_at);

CREATE TABLE IF NOT EXISTS branch_commission_payment_allocations (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  commission_payment_id varchar(36) NOT NULL REFERENCES branch_commission_payments(id) ON DELETE CASCADE,
  commission_accrual_id varchar(36) NOT NULL REFERENCES branch_commission_accruals(id) ON DELETE CASCADE,
  amount_allocated numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_commission_allocations_payment_accrual_unique
  ON branch_commission_payment_allocations (commission_payment_id, commission_accrual_id);

CREATE INDEX IF NOT EXISTS branch_commission_allocations_branch_idx
  ON branch_commission_payment_allocations (branch_id);

CREATE INDEX IF NOT EXISTS branch_commission_allocations_payment_idx
  ON branch_commission_payment_allocations (commission_payment_id);

CREATE INDEX IF NOT EXISTS branch_commission_allocations_accrual_idx
  ON branch_commission_payment_allocations (commission_accrual_id);

COMMIT;
