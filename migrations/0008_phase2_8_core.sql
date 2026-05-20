ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS summary_hours text;

CREATE TABLE IF NOT EXISTS reservation_audit_logs (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar(36) NOT NULL REFERENCES class_bookings(id),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  customer_user_id varchar(36) NOT NULL REFERENCES users(id),
  actor_user_id varchar(36) REFERENCES users(id),
  actor_role text NOT NULL,
  action text NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'system',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservation_audit_logs_booking_idx ON reservation_audit_logs (booking_id);
CREATE INDEX IF NOT EXISTS reservation_audit_logs_branch_idx ON reservation_audit_logs (branch_id);
CREATE INDEX IF NOT EXISTS reservation_audit_logs_created_at_idx ON reservation_audit_logs (created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'review_report_status'
  ) THEN
    CREATE TYPE review_report_status AS ENUM ('pending', 'reviewed', 'dismissed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS review_reports (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id varchar(36) NOT NULL REFERENCES branch_reviews(id),
  branch_id varchar(36) NOT NULL REFERENCES branches(id),
  reporter_user_id varchar(36) REFERENCES users(id),
  reported_by_role text NOT NULL DEFAULT 'CUSTOMER',
  reason text NOT NULL,
  note text,
  status review_report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  reviewed_by_user_id varchar(36) REFERENCES users(id),
  resolution_note text
);

CREATE INDEX IF NOT EXISTS review_reports_review_idx ON review_reports (review_id);
CREATE INDEX IF NOT EXISTS review_reports_branch_idx ON review_reports (branch_id);
CREATE INDEX IF NOT EXISTS review_reports_status_idx ON review_reports (status);

CREATE TABLE IF NOT EXISTS review_moderation_logs (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id varchar(36) NOT NULL REFERENCES branch_reviews(id),
  action text NOT NULL,
  actor_user_id varchar(36) REFERENCES users(id),
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_moderation_logs_review_idx ON review_moderation_logs (review_id);
CREATE INDEX IF NOT EXISTS review_moderation_logs_created_at_idx ON review_moderation_logs (created_at);

CREATE TABLE IF NOT EXISTS notification_jobs (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  branch_id varchar(36) REFERENCES branches(id),
  user_id varchar(36) REFERENCES users(id),
  payload jsonb,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_jobs_status_idx ON notification_jobs (status);
CREATE INDEX IF NOT EXISTS notification_jobs_scheduled_for_idx ON notification_jobs (scheduled_for);
CREATE INDEX IF NOT EXISTS notification_jobs_branch_idx ON notification_jobs (branch_id);
