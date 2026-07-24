BEGIN;

CREATE TABLE IF NOT EXISTS branch_inventory_balances (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  commercial_product_id varchar(36) NOT NULL REFERENCES branch_commercial_products(id),
  quantity_on_hand integer NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  minimum_stock integer NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  updated_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_inventory_balances_branch_product_unique
  ON branch_inventory_balances (branch_id, commercial_product_id);

CREATE INDEX IF NOT EXISTS branch_inventory_balances_branch_idx
  ON branch_inventory_balances (branch_id);

CREATE INDEX IF NOT EXISTS branch_inventory_balances_product_idx
  ON branch_inventory_balances (commercial_product_id);

CREATE TABLE IF NOT EXISTS branch_inventory_movements (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  commercial_product_id varchar(36) NOT NULL REFERENCES branch_commercial_products(id),
  movement_type text NOT NULL CHECK (
    movement_type IN (
      'initial',
      'manual_entry',
      'positive_adjustment',
      'negative_adjustment',
      'sale',
      'return',
      'waste',
      'damaged'
    )
  ),
  quantity_delta integer NOT NULL,
  quantity_before integer NOT NULL CHECK (quantity_before >= 0),
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  unit_cost_snapshot numeric(12,2),
  reason text NOT NULL,
  notes text,
  sale_id varchar(36) REFERENCES branch_sales(id) ON DELETE SET NULL,
  sale_item_id varchar(36) REFERENCES branch_sale_items(id) ON DELETE SET NULL,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_inventory_movements_branch_idx
  ON branch_inventory_movements (branch_id);

CREATE INDEX IF NOT EXISTS branch_inventory_movements_product_idx
  ON branch_inventory_movements (commercial_product_id);

CREATE INDEX IF NOT EXISTS branch_inventory_movements_type_idx
  ON branch_inventory_movements (movement_type);

CREATE INDEX IF NOT EXISTS branch_inventory_movements_created_at_idx
  ON branch_inventory_movements (created_at DESC);

CREATE INDEX IF NOT EXISTS branch_inventory_movements_sale_idx
  ON branch_inventory_movements (sale_id);

COMMIT;
