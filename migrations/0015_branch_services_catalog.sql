BEGIN;

CREATE TABLE IF NOT EXISTS branch_services (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  base_duration_minutes integer,
  capacity integer,
  requires_agenda boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'internal')),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by varchar(36) REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS branch_services_branch_idx
  ON branch_services (branch_id);

CREATE INDEX IF NOT EXISTS branch_services_active_idx
  ON branch_services (is_active);

CREATE INDEX IF NOT EXISTS branch_services_deleted_at_idx
  ON branch_services (deleted_at);

CREATE INDEX IF NOT EXISTS branch_services_category_idx
  ON branch_services (category);

CREATE TABLE IF NOT EXISTS branch_service_sale_options (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  service_id varchar(36) NOT NULL REFERENCES branch_services(id),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'individual'
    CHECK (type IN ('individual', 'prueba', 'paquete', 'membresia', 'day_pass', 'gift_card', 'especial')),
  price numeric(12,2) NOT NULL,
  included_uses integer,
  is_unlimited boolean NOT NULL DEFAULT false,
  validity_days integer,
  requires_registered_client boolean NOT NULL DEFAULT false,
  allows_walk_in boolean NOT NULL DEFAULT true,
  is_pos_favorite boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  internal_notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_by varchar(36) REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT branch_service_sale_options_usage_mode_check
    CHECK (NOT (is_unlimited = true AND included_uses IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS branch_service_sale_options_branch_idx
  ON branch_service_sale_options (branch_id);

CREATE INDEX IF NOT EXISTS branch_service_sale_options_service_idx
  ON branch_service_sale_options (service_id);

CREATE INDEX IF NOT EXISTS branch_service_sale_options_type_idx
  ON branch_service_sale_options (type);

CREATE INDEX IF NOT EXISTS branch_service_sale_options_active_idx
  ON branch_service_sale_options (is_active);

CREATE INDEX IF NOT EXISTS branch_service_sale_options_deleted_at_idx
  ON branch_service_sale_options (deleted_at);

COMMIT;
