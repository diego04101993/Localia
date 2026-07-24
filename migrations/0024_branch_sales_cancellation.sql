BEGIN;

ALTER TABLE branch_sales
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_idempotency_key varchar(120);

CREATE UNIQUE INDEX IF NOT EXISTS branch_sales_cancellation_idempotency_unique
  ON branch_sales (branch_id, cancellation_idempotency_key)
  WHERE cancellation_idempotency_key IS NOT NULL;

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
      'sale_cancellation',
      'return',
      'waste',
      'damaged'
    )
  );

COMMIT;
