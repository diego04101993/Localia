BEGIN;

ALTER TABLE branch_purchases
  ADD COLUMN IF NOT EXISTS tax_mode text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(8,4),
  ADD COLUMN IF NOT EXISTS subtotal_before_tax numeric(12,2),
  ADD COLUMN IF NOT EXISTS taxable_subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS tax_total numeric(12,2),
  ADD COLUMN IF NOT EXISTS grand_total numeric(12,2);

COMMIT;
