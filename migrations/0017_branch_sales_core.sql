BEGIN;

CREATE TABLE IF NOT EXISTS branch_sales (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  folio text NOT NULL,
  client_user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  seller_user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'dashboard_products',
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('draft', 'completed', 'cancelled')),
  subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_sales_branch_folio_unique
  ON branch_sales (branch_id, folio);

CREATE INDEX IF NOT EXISTS branch_sales_branch_idx
  ON branch_sales (branch_id);

CREATE INDEX IF NOT EXISTS branch_sales_created_at_idx
  ON branch_sales (created_at DESC);

CREATE INDEX IF NOT EXISTS branch_sales_client_user_idx
  ON branch_sales (client_user_id);

CREATE INDEX IF NOT EXISTS branch_sales_status_idx
  ON branch_sales (status);

CREATE TABLE IF NOT EXISTS branch_sale_items (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id varchar(36) NOT NULL REFERENCES branch_sales(id) ON DELETE CASCADE,
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  item_type text NOT NULL
    CHECK (item_type IN ('commercial_product', 'service', 'plan', 'other')),
  commercial_product_id varchar(36) REFERENCES branch_commercial_products(id) ON DELETE SET NULL,
  service_id varchar(36) REFERENCES branch_services(id) ON DELETE SET NULL,
  plan_id varchar(36) REFERENCES membership_plans(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  category_snapshot text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  cost_amount_snapshot numeric(12,2) NOT NULL DEFAULT 0,
  line_total_amount numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_sale_items_sale_idx
  ON branch_sale_items (sale_id);

CREATE INDEX IF NOT EXISTS branch_sale_items_branch_idx
  ON branch_sale_items (branch_id);

CREATE INDEX IF NOT EXISTS branch_sale_items_commercial_product_idx
  ON branch_sale_items (commercial_product_id);

CREATE INDEX IF NOT EXISTS branch_sale_items_item_type_idx
  ON branch_sale_items (item_type);

CREATE TABLE IF NOT EXISTS branch_sale_payments (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id varchar(36) NOT NULL REFERENCES branch_sales(id) ON DELETE CASCADE,
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  payment_method text NOT NULL
    CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'mercado_pago', 'otro')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_sale_payments_sale_idx
  ON branch_sale_payments (sale_id);

CREATE INDEX IF NOT EXISTS branch_sale_payments_branch_idx
  ON branch_sale_payments (branch_id);

CREATE INDEX IF NOT EXISTS branch_sale_payments_paid_at_idx
  ON branch_sale_payments (paid_at DESC);

COMMIT;
