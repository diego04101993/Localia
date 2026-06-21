BEGIN;

CREATE TABLE IF NOT EXISTS branch_monthly_billing (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL UNIQUE REFERENCES branches(id),
  monthly_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_day integer NOT NULL CHECK (payment_day BETWEEN 1 AND 31),
  last_payment_date date,
  next_payment_date date,
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  seller_name text,
  seller_commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_monthly_billing_status_idx
  ON branch_monthly_billing (payment_status);

CREATE INDEX IF NOT EXISTS branch_monthly_billing_next_payment_date_idx
  ON branch_monthly_billing (next_payment_date);

CREATE INDEX IF NOT EXISTS branch_monthly_billing_seller_name_idx
  ON branch_monthly_billing (seller_name);

COMMIT;
