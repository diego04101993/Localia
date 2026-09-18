BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $gate$
BEGIN
  IF to_regclass('public.branch_expense_obligations') IS NOT NULL
     OR to_regclass('public.branch_expense_obligation_payments') IS NOT NULL THEN
    RAISE EXCEPTION '0038 requires both new tables to be absent';
  END IF;
END
$gate$;

CREATE UNIQUE INDEX IF NOT EXISTS branch_suppliers_branch_id_id_unique
  ON public.branch_suppliers (branch_id, id);

DO $gate$
DECLARE
  expected record;
BEGIN
  FOR expected IN
    SELECT *
    FROM (VALUES
      ('branch_suppliers_branch_id_id_unique', 'branch_suppliers'),
      ('branch_commercial_projects_branch_id_id_unique',
       'branch_commercial_projects'),
      ('branch_finance_entries_branch_id_id_unique',
       'branch_finance_entries')
    ) AS required(index_name, table_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class idx
      JOIN pg_namespace idx_ns ON idx_ns.oid = idx.relnamespace
      JOIN pg_index i ON i.indexrelid = idx.oid
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace
      JOIN pg_am am ON am.oid = idx.relam
      WHERE idx_ns.nspname = 'public'
        AND idx.relname = expected.index_name
        AND tbl_ns.nspname = 'public'
        AND tbl.relname = expected.table_name
        AND am.amname = 'btree'
        AND i.indisunique
        AND i.indisvalid
        AND i.indisready
        AND i.indimmediate
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts = 2
        AND i.indnatts = 2
        AND pg_get_indexdef(idx.oid, 1, false) = 'branch_id'
        AND pg_get_indexdef(idx.oid, 2, false) = 'id'
    ) THEN
      RAISE EXCEPTION 'Missing or unsuitable FK unique index: %',
        expected.index_name;
    END IF;
  END LOOP;
END
$gate$;

CREATE TABLE public.branch_expense_obligations (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL,
  project_id varchar(36),
  supplier_id varchar(36),
  beneficiary_name_snapshot text NOT NULL,
  concept text NOT NULL,
  category text,
  document_reference text,
  issue_date date NOT NULL,
  due_date date,
  notes text,
  document_status text NOT NULL DEFAULT 'draft',
  subtotal_amount numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  subtotal_before_tax numeric(12,2) NOT NULL,
  taxable_subtotal numeric(12,2) NOT NULL,
  tax_mode text NOT NULL,
  tax_rate numeric(8,4) NOT NULL,
  tax_total numeric(12,2) NOT NULL,
  grand_total numeric(12,2) NOT NULL,
  idempotency_key varchar(120) NOT NULL,
  idempotency_fingerprint varchar(64) NOT NULL,
  created_by varchar(36),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,

  CONSTRAINT branch_expense_obligations_branch_id_id_unique
    UNIQUE (branch_id, id),
  CONSTRAINT branch_expense_obligations_branch_key_unique
    UNIQUE (branch_id, idempotency_key),

  CONSTRAINT branch_expense_obligations_branch_fk
    FOREIGN KEY (branch_id)
    REFERENCES public.branches(id) ON DELETE RESTRICT,
  CONSTRAINT branch_expense_obligations_project_fk
    FOREIGN KEY (branch_id, project_id)
    REFERENCES public.branch_commercial_projects(branch_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT branch_expense_obligations_supplier_fk
    FOREIGN KEY (branch_id, supplier_id)
    REFERENCES public.branch_suppliers(branch_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT branch_expense_obligations_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE SET NULL,

  CONSTRAINT branch_expense_obligations_identity_check
    CHECK (
      char_length(btrim(beneficiary_name_snapshot)) BETWEEN 1 AND 160
      AND char_length(btrim(concept)) BETWEEN 1 AND 160
    ),
  CONSTRAINT branch_expense_obligations_status_check
    CHECK (
      document_status IN ('draft', 'open', 'cancelled')
      AND (document_status = 'cancelled') = (cancelled_at IS NOT NULL)
    ),
  CONSTRAINT branch_expense_obligations_key_check
    CHECK (
      idempotency_key = btrim(idempotency_key)
      AND char_length(idempotency_key) BETWEEN 8 AND 120
      AND idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      AND idempotency_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT branch_expense_obligations_finite_check
    CHECK (
      subtotal_amount::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND discount_amount::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND subtotal_before_tax::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND taxable_subtotal::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND tax_rate::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND tax_total::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND grand_total::text NOT IN ('NaN', 'Infinity', '-Infinity')
    ),
  CONSTRAINT branch_expense_obligations_amount_check
    CHECK (
      subtotal_amount > 0
      AND discount_amount >= 0
      AND discount_amount < subtotal_amount
      AND subtotal_before_tax >= 0
      AND taxable_subtotal >= 0
      AND tax_total >= 0
      AND grand_total > 0
    ),
  CONSTRAINT branch_expense_obligations_tax_check
    CHECK (
      (
        tax_mode = 'tax_exempt'
        AND tax_rate = 0
        AND subtotal_before_tax = subtotal_amount
        AND taxable_subtotal = subtotal_amount - discount_amount
        AND tax_total = 0
        AND grand_total = taxable_subtotal
      )
      OR
      (
        tax_mode = 'tax_added'
        AND tax_rate > 0 AND tax_rate <= 100
        AND subtotal_before_tax = subtotal_amount
        AND taxable_subtotal = subtotal_amount - discount_amount
        AND tax_total = round(taxable_subtotal * tax_rate / 100, 2)
        AND grand_total = taxable_subtotal + tax_total
      )
      OR
      (
        tax_mode = 'tax_included'
        AND tax_rate > 0 AND tax_rate <= 100
        AND subtotal_before_tax =
          round(subtotal_amount / (1 + tax_rate / 100), 2)
        AND taxable_subtotal =
          round((subtotal_amount - discount_amount)
                / (1 + tax_rate / 100), 2)
        AND grand_total = subtotal_amount - discount_amount
        AND tax_total = grand_total - taxable_subtotal
      )
    )
);

CREATE INDEX branch_expense_obligations_branch_status_issue_idx
  ON public.branch_expense_obligations
  (branch_id, document_status, issue_date DESC, id);

CREATE INDEX branch_expense_obligations_branch_project_idx
  ON public.branch_expense_obligations
  (branch_id, project_id, document_status, issue_date DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX branch_expense_obligations_branch_supplier_idx
  ON public.branch_expense_obligations
  (branch_id, supplier_id, document_status)
  WHERE supplier_id IS NOT NULL;

CREATE INDEX branch_expense_obligations_branch_due_open_idx
  ON public.branch_expense_obligations (branch_id, due_date, id)
  WHERE document_status = 'open' AND due_date IS NOT NULL;

CREATE TABLE public.branch_expense_obligation_payments (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL,
  obligation_id varchar(36) NOT NULL,
  idempotency_key varchar(120) NOT NULL,
  idempotency_fingerprint varchar(64) NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  entry_date date NOT NULL,
  reference text,
  notes text,
  finance_entry_id varchar(36) NOT NULL,
  created_by varchar(36),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT branch_expense_obligation_payments_branch_key_unique
    UNIQUE (branch_id, idempotency_key),
  CONSTRAINT branch_expense_obligation_payments_finance_unique
    UNIQUE (finance_entry_id),

  CONSTRAINT branch_expense_obligation_payments_branch_fk
    FOREIGN KEY (branch_id)
    REFERENCES public.branches(id) ON DELETE RESTRICT,
  CONSTRAINT branch_expense_obligation_payments_obligation_fk
    FOREIGN KEY (branch_id, obligation_id)
    REFERENCES public.branch_expense_obligations(branch_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT branch_expense_obligation_payments_finance_fk
    FOREIGN KEY (branch_id, finance_entry_id)
    REFERENCES public.branch_finance_entries(branch_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT branch_expense_obligation_payments_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE SET NULL,

  CONSTRAINT branch_expense_obligation_payments_amount_check
    CHECK (
      amount::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND amount > 0
    ),
  CONSTRAINT branch_expense_obligation_payments_method_check
    CHECK (
      payment_method IN (
        'efectivo', 'tarjeta', 'transferencia', 'mercado_pago', 'otro'
      )
    ),
  CONSTRAINT branch_expense_obligation_payments_key_check
    CHECK (
      idempotency_key = btrim(idempotency_key)
      AND char_length(idempotency_key) BETWEEN 8 AND 120
      AND idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      AND idempotency_fingerprint ~ '^[0-9a-f]{64}$'
    )
);

CREATE INDEX branch_expense_obligation_payments_branch_obligation_paid_idx
  ON public.branch_expense_obligation_payments
  (branch_id, obligation_id, paid_at DESC, id);

COMMIT;
