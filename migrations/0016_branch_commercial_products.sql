BEGIN;

CREATE TABLE IF NOT EXISTS branch_commercial_products (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  photo_url text,
  sku text,
  barcode text,
  cost_amount numeric(12,2) NOT NULL DEFAULT 0,
  sale_price_amount numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_public_visible boolean NOT NULL DEFAULT false,
  uses_inventory boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_by varchar(36) REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_commercial_products_branch_idx
  ON branch_commercial_products (branch_id);

CREATE INDEX IF NOT EXISTS branch_commercial_products_active_idx
  ON branch_commercial_products (is_active);

CREATE INDEX IF NOT EXISTS branch_commercial_products_public_idx
  ON branch_commercial_products (is_public_visible);

CREATE INDEX IF NOT EXISTS branch_commercial_products_deleted_at_idx
  ON branch_commercial_products (deleted_at);

CREATE INDEX IF NOT EXISTS branch_commercial_products_sku_idx
  ON branch_commercial_products (sku);

CREATE INDEX IF NOT EXISTS branch_commercial_products_barcode_idx
  ON branch_commercial_products (barcode);

COMMIT;
