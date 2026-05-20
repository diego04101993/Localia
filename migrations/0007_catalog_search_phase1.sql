CREATE TABLE IF NOT EXISTS categories (
  key text PRIMARY KEY,
  label text NOT NULL,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subcategories (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL REFERENCES categories(key),
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_keywords (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text REFERENCES categories(key),
  subcategory_id varchar(36) REFERENCES subcategories(id),
  keyword text NOT NULL,
  normalized_keyword text NOT NULL,
  kind text NOT NULL DEFAULT 'alias',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL,
  scope text NOT NULL DEFAULT 'global',
  updated_by varchar(36) REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_logs (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(36) REFERENCES users(id),
  query_raw text,
  query_normalized text,
  category text,
  subcategory text,
  lat double precision,
  lng double precision,
  zone text,
  result_count integer NOT NULL DEFAULT 0,
  selected_branch_id varchar(36) REFERENCES branches(id),
  source text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_is_active_idx ON categories (is_active);
CREATE INDEX IF NOT EXISTS categories_display_order_idx ON categories (display_order);
CREATE INDEX IF NOT EXISTS subcategories_category_key_idx ON subcategories (category_key);
CREATE INDEX IF NOT EXISTS subcategories_is_active_idx ON subcategories (is_active);
CREATE INDEX IF NOT EXISTS category_keywords_category_key_idx ON category_keywords (category_key);
CREATE INDEX IF NOT EXISTS category_keywords_subcategory_id_idx ON category_keywords (subcategory_id);
CREATE INDEX IF NOT EXISTS category_keywords_normalized_keyword_idx ON category_keywords (normalized_keyword);
CREATE INDEX IF NOT EXISTS app_settings_scope_idx ON app_settings (scope);
CREATE INDEX IF NOT EXISTS search_logs_created_at_idx ON search_logs (created_at);
CREATE INDEX IF NOT EXISTS search_logs_query_normalized_idx ON search_logs (query_normalized);
CREATE INDEX IF NOT EXISTS search_logs_category_idx ON search_logs (category);

INSERT INTO categories (key, label, icon, is_active, display_order)
VALUES
  ('box', 'Box / CrossFit', 'dumbbell', true, 10),
  ('gym', 'Gimnasio', 'dumbbell', true, 20),
  ('yoga', 'Yoga / Pilates', 'flower-2', true, 30),
  ('estetica', 'Estética / Spa', 'sparkles', true, 40),
  ('doctor', 'Doctor / Clínica', 'stethoscope', true, 50),
  ('abogado', 'Abogado / Legal', 'scale', true, 60),
  ('freelancer', 'Freelancer / Consultor', 'briefcase', true, 70),
  ('otro', 'Otro', 'shapes', true, 80)
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  icon = COALESCE(categories.icon, EXCLUDED.icon),
  display_order = EXCLUDED.display_order;

INSERT INTO app_settings (key, value_json, scope)
VALUES
  ('search.default_radius_km', '{"value": 50}'::jsonb, 'global'),
  ('search.max_radius_km', '{"value": 100}'::jsonb, 'global'),
  ('search.suggestions_limit', '{"value": 10}'::jsonb, 'global')
ON CONFLICT (key) DO NOTHING;

