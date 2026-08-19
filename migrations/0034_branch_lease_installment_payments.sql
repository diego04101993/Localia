BEGIN;

ALTER TABLE branch_charge_events
  DROP CONSTRAINT IF EXISTS branch_charge_events_charge_domain_check,
  DROP CONSTRAINT IF EXISTS branch_charge_events_event_type_check;

ALTER TABLE branch_charge_events
  ADD CONSTRAINT branch_charge_events_charge_domain_check
    CHECK (charge_domain IN ('membership_plan', 'lease_installment')),
  ADD CONSTRAINT branch_charge_events_event_type_check
    CHECK (event_type IN ('assign', 'renew', 'payment'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branch_charge_events_lease_installment_payment_shape_check'
      AND conrelid = 'branch_charge_events'::regclass
  ) THEN
    ALTER TABLE branch_charge_events
      ADD CONSTRAINT branch_charge_events_lease_installment_payment_shape_check
      CHECK (
        (
          charge_domain = 'membership_plan'
          AND event_type IN ('assign', 'renew')
        )
        OR (
          charge_domain = 'lease_installment'
          AND event_type = 'payment'
          AND lease_contract_id IS NOT NULL
          AND lease_installment_id IS NOT NULL
          AND client_user_id IS NOT NULL
          AND finance_entry_id IS NOT NULL
          AND tax_mode IS NOT NULL
          AND tax_rate IS NOT NULL
          AND subtotal_before_tax_cents IS NOT NULL
          AND taxable_subtotal_cents IS NOT NULL
          AND tax_total_cents IS NOT NULL
          AND subtotal_before_tax_cents >= 0
          AND taxable_subtotal_cents >= 0
          AND tax_total_cents >= 0
        )
      );
  END IF;
END
$$;

COMMIT;
