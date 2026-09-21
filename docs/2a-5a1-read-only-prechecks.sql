-- READ ONLY. Prepared locally; not executed against any database.
-- Every statement is SELECT (including CTEs). No historical repairs.
-- NULL branch_id means all branches. Replace it in each params CTE to scope.
-- P1. Inactive plans and active memberships without a plan, per branch.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT b.id AS branch_id, b.name AS branch_name,
  (SELECT count(*) FROM membership_plans p
   WHERE p.branch_id = b.id AND NOT p.is_active) AS inactive_plans,
  (SELECT count(*) FROM memberships m
   WHERE m.branch_id = b.id AND m.status = 'active'
     AND m.plan_id IS NULL) AS active_memberships_without_plan,
  (SELECT count(*) FROM memberships m
   WHERE m.branch_id = b.id AND m.status = 'active'
     AND m.plan_id IS NULL AND m.plan_name_snapshot IS NOT NULL)
     AS without_plan_with_name_snapshot
FROM branches b CROSS JOIN params
WHERE params.branch_id IS NULL OR b.id = params.branch_id
ORDER BY b.name, b.id;

-- P2. Direct historical IDs, deactivation evidence and explicit removals.
-- A charge proves a previous relationship, NOT entitlement to restore today.
-- created_at orders capture; charged_at can be a retroactive payment date.
-- A name match or DEACTIVATE_PLAN count does not identify affected memberships.
WITH params AS (SELECT NULL::varchar(36) AS branch_id), candidates AS (
  SELECT m.* FROM memberships m CROSS JOIN params
  WHERE m.status = 'active' AND m.plan_id IS NULL
    AND (params.branch_id IS NULL OR m.branch_id = params.branch_id)
), evidence AS (
  SELECT m.id, count(ce.id) AS prior_charge_count,
    count(DISTINCT ce.plan_id) AS distinct_prior_plan_ids,
    array_agg(DISTINCT ce.plan_id) FILTER (WHERE ce.plan_id IS NOT NULL) AS prior_plan_ids,
    count(ce.id) FILTER (WHERE ce.plan_id IS NULL) AS charges_without_plan_id
  FROM candidates m LEFT JOIN branch_charge_events ce
    ON ce.branch_id = m.branch_id AND ce.membership_id = m.id
    AND ce.client_user_id = m.user_id AND ce.charge_domain = 'membership_plan'
    AND ce.event_type IN ('assign', 'renew')
  GROUP BY m.id
), details AS (
  SELECT m.branch_id, m.id AS membership_id, m.user_id, u.name, u.last_name,
    m.client_status, m.plan_name_snapshot, m.paid_at, m.expires_at,
    e.prior_charge_count, e.distinct_prior_plan_ids, e.prior_plan_ids,
    e.charges_without_plan_id, latest.id AS latest_charge_event_id,
    latest.plan_id AS latest_plan_id, latest.created_at AS latest_charge_recorded_at,
    latest.charged_at AS latest_charge_paid_at, p.is_active AS latest_plan_is_active,
    deactivation.created_at AS latest_deactivation_at,
    deactivation.metadata AS deactivation_metadata,
    removal.created_at AS latest_explicit_removal_at,
    removal.metadata AS removal_metadata,
    CASE WHEN e.prior_charge_count = 0 THEN 'NO_DIRECT_CHARGE_EVIDENCE'
         WHEN e.distinct_prior_plan_ids = 0 THEN 'HISTORICAL_PLAN_ID_MISSING'
         WHEN e.distinct_prior_plan_ids = 1 AND e.charges_without_plan_id = 0
           THEN 'ONE_PREVIOUS_PLAN_PROVEN_RESTORE_REQUIRES_REVIEW'
         ELSE 'MULTIPLE_OR_INCOMPLETE_HISTORICAL_RELATIONSHIPS' END AS evidence_status,
    (deactivation.id IS NOT NULL) AS possibly_affected_by_deactivation
  FROM candidates m JOIN users u ON u.id = m.user_id JOIN evidence e ON e.id = m.id
  LEFT JOIN LATERAL (
    SELECT ce.* FROM branch_charge_events ce
    WHERE ce.branch_id = m.branch_id AND ce.membership_id = m.id
      AND ce.client_user_id = m.user_id AND ce.charge_domain = 'membership_plan'
      AND ce.event_type IN ('assign', 'renew')
    ORDER BY ce.created_at DESC, ce.id DESC LIMIT 1
  ) latest ON true
  LEFT JOIN membership_plans p ON p.id = latest.plan_id AND p.branch_id = m.branch_id
  LEFT JOIN LATERAL (
    SELECT a.id, a.created_at, a.metadata FROM audit_logs a
    WHERE a.branch_id = m.branch_id AND a.action = 'DEACTIVATE_PLAN'
      AND a.metadata ->> 'planId' = latest.plan_id
      AND a.created_at >= latest.created_at
    ORDER BY a.created_at DESC, a.id DESC LIMIT 1
  ) deactivation ON true
  LEFT JOIN LATERAL (
    SELECT a.created_at, a.metadata FROM audit_logs a
    WHERE a.branch_id = m.branch_id AND a.action = 'REMOVE_PLAN'
      AND a.metadata ->> 'membershipId' = m.id
    ORDER BY a.created_at DESC, a.id DESC LIMIT 1
  ) removal ON true
)
SELECT details.*,
  count(*) OVER () AS total_candidates,
  count(*) FILTER (WHERE possibly_affected_by_deactivation) OVER () AS possible_deactivation_cases
FROM details ORDER BY branch_id, membership_id;

-- P3. Existing cross-branch or missing plan relationships, regardless of status.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT m.id AS membership_id, m.branch_id, m.status, m.client_status,
  m.plan_id, p.branch_id AS plan_branch_id
FROM memberships m CROSS JOIN params LEFT JOIN membership_plans p ON p.id = m.plan_id
WHERE m.plan_id IS NOT NULL AND (p.id IS NULL OR p.branch_id <> m.branch_id)
  AND (params.branch_id IS NULL OR m.branch_id = params.branch_id);

-- S1. Finance entries with no linked log. Do not match by name, date or amount.
-- Historical code wrote finance_entry_id before source_id, so either link is shown.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT f.id AS finance_entry_id, f.branch_id, f.source_id, f.amount,
  f.entry_date, f.created_at, f.deleted_at, f.metadata
FROM branch_finance_entries f CROSS JOIN params
WHERE f.source = 'staff_class_log'
  AND (params.branch_id IS NULL OR f.branch_id = params.branch_id)
  AND NOT EXISTS (
    SELECT 1 FROM branch_staff_class_logs l
    WHERE l.finance_entry_id = f.id OR l.id = f.source_id
  )
ORDER BY f.branch_id, f.created_at, f.id;

-- S2. Missing/deleted finance rows, broken reciprocal links, cross-branch and amounts.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT l.id AS class_log_id, l.branch_id, l.staff_id, l.class_date,
  l.classes_count, l.payment_total, l.finance_entry_id,
  f.branch_id AS finance_branch_id, s.branch_id AS staff_branch_id,
  f.type, f.source, f.source_id, f.amount, f.deleted_at,
  (f.id IS NULL) AS finance_missing,
  (f.deleted_at IS NOT NULL) AS finance_soft_deleted,
  (s.id IS NULL OR s.branch_id IS DISTINCT FROM l.branch_id
    OR (f.id IS NOT NULL AND f.branch_id IS DISTINCT FROM l.branch_id)) AS tenant_mismatch,
  (f.id IS NOT NULL AND f.amount IS DISTINCT FROM l.payment_total) AS amount_mismatch,
  (f.id IS NOT NULL AND (f.source IS DISTINCT FROM 'staff_class_log'
    OR f.source_id IS DISTINCT FROM l.id OR f.type IS DISTINCT FROM 'expense')) AS link_mismatch
FROM branch_staff_class_logs l CROSS JOIN params
LEFT JOIN branch_finance_entries f ON f.id = l.finance_entry_id
LEFT JOIN branch_staff_members s ON s.id = l.staff_id
WHERE (params.branch_id IS NULL OR l.branch_id = params.branch_id)
  AND (f.id IS NULL OR f.deleted_at IS NOT NULL OR s.id IS NULL
    OR s.branch_id IS DISTINCT FROM l.branch_id
    OR f.branch_id IS DISTINCT FROM l.branch_id
    OR f.amount IS DISTINCT FROM l.payment_total
    OR f.source IS DISTINCT FROM 'staff_class_log'
    OR f.source_id IS DISTINCT FROM l.id OR f.type IS DISTINCT FROM 'expense')
ORDER BY l.branch_id, l.class_date, l.id;

-- S3. Reverse links also detect an extra finance entry pointing at a valid log.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT f.id AS finance_entry_id, f.branch_id, f.source_id,
  l.branch_id AS log_branch_id, l.finance_entry_id AS log_finance_entry_id
FROM branch_finance_entries f CROSS JOIN params
JOIN branch_staff_class_logs l ON l.id = f.source_id
WHERE f.source = 'staff_class_log'
  AND (params.branch_id IS NULL OR f.branch_id = params.branch_id)
  AND (l.branch_id IS DISTINCT FROM f.branch_id OR l.finance_entry_id IS DISTINCT FROM f.id);

-- S4. Candidate duplicate work logs; identical work/date is NOT proof of a duplicate.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT l.branch_id, l.staff_id, l.class_date, l.classes_count, l.payment_total,
  count(*) AS candidate_count, array_agg(l.id ORDER BY l.created_at, l.id) AS class_log_ids,
  array_agg(l.finance_entry_id ORDER BY l.created_at, l.id) AS finance_entry_ids
FROM branch_staff_class_logs l CROSS JOIN params
WHERE params.branch_id IS NULL OR l.branch_id = params.branch_id
GROUP BY l.branch_id, l.staff_id, l.class_date, l.classes_count, l.payment_total
HAVING count(*) > 1;

-- S5. Finance link duplication. NULL source_id is not grouped as a duplicate.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT f.branch_id, f.source_id, count(*) AS entry_count,
  array_agg(f.id ORDER BY f.created_at, f.id) AS finance_entry_ids
FROM branch_finance_entries f CROSS JOIN params
WHERE f.source = 'staff_class_log' AND f.source_id IS NOT NULL
  AND (params.branch_id IS NULL OR f.branch_id = params.branch_id)
GROUP BY f.branch_id, f.source_id HAVING count(*) > 1;

-- S6. More than one work log references the same finance entry.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT l.finance_entry_id, count(*) AS log_count,
  array_agg(l.id ORDER BY l.id) AS class_log_ids,
  array_agg(DISTINCT l.branch_id) AS branch_ids
FROM branch_staff_class_logs l
WHERE l.finance_entry_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM branch_staff_class_logs scoped CROSS JOIN params
  WHERE scoped.finance_entry_id = l.finance_entry_id
    AND (params.branch_id IS NULL OR scoped.branch_id = params.branch_id)
)
GROUP BY l.finance_entry_id HAVING count(*) > 1;

-- S7. Exact audit references for manual investigation, without interpreting names.
WITH params AS (SELECT NULL::varchar(36) AS branch_id)
SELECT a.id AS audit_id, a.branch_id, a.actor_user_id, a.action, a.created_at,
  a.metadata ->> 'classLogId' AS class_log_id,
  a.metadata ->> 'financeEntryId' AS finance_entry_id, a.metadata
FROM audit_logs a CROSS JOIN params
WHERE a.action = 'REGISTER_STAFF_CLASSES_IN_FINANCE'
  AND (params.branch_id IS NULL OR a.branch_id = params.branch_id)
ORDER BY a.branch_id, a.created_at, a.id;
