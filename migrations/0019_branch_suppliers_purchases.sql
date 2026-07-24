BEGIN;

CREATE TABLE IF NOT EXISTS branch_suppliers (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  tax_id text,
  address text,
  payment_terms text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_suppliers_branch_idx
  ON branch_suppliers (branch_id);

CREATE INDEX IF NOT EXISTS branch_suppliers_active_idx
  ON branch_suppliers (is_active);

CREATE INDEX IF NOT EXISTS branch_suppliers_deleted_at_idx
  ON branch_suppliers (deleted_at);

CREATE INDEX IF NOT EXISTS branch_suppliers_name_idx
  ON branch_suppliers (name);

CREATE TABLE IF NOT EXISTS branch_purchases (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  folio text NOT NULL,
  supplier_id varchar(36) REFERENCES branch_suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')
  ),
  purchase_date date NOT NULL,
  expected_date date,
  received_at timestamptz,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (
    payment_status IN ('unpaid', 'partial', 'paid')
  ),
  payment_method text,
  subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  reference text,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_purchases_branch_folio_unique
  ON branch_purchases (branch_id, folio);

CREATE INDEX IF NOT EXISTS branch_purchases_branch_idx
  ON branch_purchases (branch_id);

CREATE INDEX IF NOT EXISTS branch_purchases_supplier_idx
  ON branch_purchases (supplier_id);

CREATE INDEX IF NOT EXISTS branch_purchases_status_idx
  ON branch_purchases (status);

CREATE INDEX IF NOT EXISTS branch_purchases_payment_status_idx
  ON branch_purchases (payment_status);

CREATE INDEX IF NOT EXISTS branch_purchases_purchase_date_idx
  ON branch_purchases (purchase_date);

CREATE INDEX IF NOT EXISTS branch_purchases_created_at_idx
  ON branch_purchases (created_at DESC);

CREATE TABLE IF NOT EXISTS branch_purchase_items (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id varchar(36) NOT NULL REFERENCES branch_purchases(id) ON DELETE CASCADE,
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  commercial_product_id varchar(36) REFERENCES branch_commercial_products(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  sku_snapshot text,
  quantity_ordered integer NOT NULL CHECK (quantity_ordered > 0),
  quantity_received integer NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_purchase_items_received_lte_ordered CHECK (quantity_received <= quantity_ordered)
);

CREATE INDEX IF NOT EXISTS branch_purchase_items_purchase_idx
  ON branch_purchase_items (purchase_id);

CREATE INDEX IF NOT EXISTS branch_purchase_items_branch_idx
  ON branch_purchase_items (branch_id);

CREATE INDEX IF NOT EXISTS branch_purchase_items_commercial_product_idx
  ON branch_purchase_items (commercial_product_id);

ALTER TABLE branch_inventory_movements
  ADD COLUMN IF NOT EXISTS purchase_id varchar(36) REFERENCES branch_purchases(id) ON DELETE SET NULL;

ALTER TABLE branch_inventory_movements
  ADD COLUMN IF NOT EXISTS purchase_item_id varchar(36) REFERENCES branch_purchase_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS branch_inventory_movements_purchase_idx
  ON branch_inventory_movements (purchase_id);

ALTER TABLE branch_inventory_movements
  DROP CONSTRAINT IF EXISTS branch_inventory_movements_movement_type_check;

ALTER TABLE branch_inventory_movements
  ADD CONSTRAINT branch_inventory_movements_movement_type_check CHECK (
    movement_type IN (
      'initial',
      'manual_entry',
      'positive_adjustment',
      'negative_adjustment',
      'purchase',
      'sale',
      'return',
      'waste',
      'damaged'
    )
  );

COMMIT;
