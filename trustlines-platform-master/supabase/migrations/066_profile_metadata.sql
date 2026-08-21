-- 066_profile_metadata.sql — PHASE 11.2 Profile Metadata
--
-- Adds the org metadata that a role alone cannot express (PHASE-11 §3): which side of
-- the company someone is on, their office/department, their design skills, their manager
-- and their region / service-line scope.
--
-- Role model (CLAUDE.md / AGENTS.md): profiles.role is TEXT — there is NO `user_role`
-- enum in the live DB. Nothing here touches roles.
--
-- ADDITIVE ONLY. Nothing is renamed or dropped. The existing scope columns
-- (pm_client_id, sales_region_id, is_pm_supervisor, category_scope) are LEFT ALONE —
-- they are live-used by the PO signature chain, the tlines_pm/AI scope and the board.
-- region_ids[]/service_line_ids[] are ADDITIONAL multi-scope, not replacements.
--
-- Idempotent / re-runnable: ADD COLUMN IF NOT EXISTS + guarded constraint creation.

-- ── 1. Columns ───────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_side     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills           TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id       UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region_ids       UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_line_ids UUID[] NOT NULL DEFAULT '{}';
-- `office` already exists (migration 051) as free TEXT. `is_active` already exists.

-- ── 2. Normalise `office` BEFORE constraining it ─────────────────────────────────
-- 051 stored office as free text (the designer invite form suggested "e.g. Syria
-- Office"). Phase 11 §3 wants a fixed set: turkey | syria | usa | other.
-- The live probe (2026-07-16) found office NULL on 10/10 profiles, so there is nothing
-- to convert today — but this must stay correct for any DB where someone did type a
-- value, so map the known shapes rather than assuming emptiness. Unrecognised non-empty
-- text becomes 'other' (never dropped silently: 'other' preserves "has an office, not
-- one of the three"); blank/whitespace becomes NULL.
UPDATE profiles SET office = CASE
  WHEN office IS NULL OR btrim(office) = ''         THEN NULL
  WHEN office IN ('turkey','syria','usa','other')   THEN office          -- already a code
  WHEN office ILIKE '%turk%' OR office ILIKE '%türk%' THEN 'turkey'
  WHEN office ILIKE '%syri%' OR office ILIKE '%suri%' THEN 'syria'
  WHEN office ILIKE '%usa%'  OR office ILIKE '%united states%' OR office ILIKE '%america%' THEN 'usa'
  ELSE 'other'
END
WHERE office IS NULL OR office NOT IN ('turkey','syria','usa','other');

-- ── 3. Constraints (added AFTER normalisation so they cannot fail on live data) ──
-- Each is dropped first so re-running the file cannot error on an existing constraint.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_company_side_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_company_side_check
  CHECK (company_side IS NULL OR company_side IN ('trust_lines','t_lines'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_office_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_office_check
  CHECK (office IS NULL OR office IN ('turkey','syria','usa','other'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_department_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_department_check
  CHECK (department IS NULL OR department IN
    ('sales','design','pm','supply','production','qc','warehouse','logistics','accounting','management'));

-- Every element of skills[] must be a known discipline (Phase 11.1: discipline is a
-- SKILL, not a role — one person carries several).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_skills_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_skills_check
  CHECK (skills <@ ARRAY['millwork','shelving','ceiling','image','graphic','shop_drawing','furniture','decoration']::TEXT[]);

-- Nobody manages themselves (an easy admin-UI slip that would break any org-chart walk).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_manager_not_self_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_manager_not_self_check
  CHECK (manager_id IS NULL OR manager_id <> id);

-- ── 4. Indexes ───────────────────────────────────────────────────────────────────
-- AGENTS.md §5: Postgres does not auto-index FKs, and every new frequent filter needs
-- one. These back the workspace/admin filters ("who is in Design?", "my team",
-- "designers who can do ceiling").
CREATE INDEX IF NOT EXISTS idx_profiles_department   ON profiles(department)   WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_company_side ON profiles(company_side) WHERE company_side IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_office       ON profiles(office)       WHERE office IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_manager      ON profiles(manager_id)   WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_skills       ON profiles USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_profiles_region_ids   ON profiles USING GIN (region_ids);
CREATE INDEX IF NOT EXISTS idx_profiles_service_ids  ON profiles USING GIN (service_line_ids);

-- ── 5. Backfill company_side + department from the existing role ─────────────────
-- ~40 users are coming; the 10 who already exist should not start blank. This mirrors
-- lib/profile/metadata.ts (defaultCompanySideForRole / defaultDepartmentForRole) — keep
-- the two in sync. Only fills NULLs, so it never overwrites an admin's correction and
-- is safe to re-run.
--
-- company_side: t_lines = the CUSTOMER-facing side (Sales + T-Lines PM) — the same wall
-- Phase 11 §7 draws for PF/price/margin. Everyone else is Trust Lines internal.
UPDATE profiles SET company_side = 't_lines'
 WHERE company_side IS NULL AND role IN ('tlines_pm','sales_rep','sales_marketing_manager');
UPDATE profiles SET company_side = 'trust_lines'
 WHERE company_side IS NULL AND role IS NOT NULL;

UPDATE profiles SET department = CASE role
  WHEN 'ops_manager'             THEN 'management'
  WHEN 'general_manager'         THEN 'management'
  WHEN 'sales_rep'               THEN 'sales'
  WHEN 'sales_marketing_manager' THEN 'sales'
  WHEN 'designer'                THEN 'design'
  WHEN 'design_lead'             THEN 'design'
  WHEN 'shop_drawer'             THEN 'design'
  WHEN 'tlines_pm'               THEN 'pm'
  WHEN 'trustlines_pm'           THEN 'pm'
  WHEN 'project_manager'         THEN 'pm'
  WHEN 'supply_manager'          THEN 'supply'
  WHEN 'supply_user'             THEN 'supply'
  WHEN 'production_manager'      THEN 'production'
  WHEN 'production_user'         THEN 'production'
  WHEN 'pm_millwork'             THEN 'production'
  WHEN 'pm_ceiling'              THEN 'production'
  WHEN 'qc_responsible'          THEN 'qc'
  WHEN 'warehouse_manager'       THEN 'warehouse'
  WHEN 'warehouse_user'          THEN 'warehouse'
  WHEN 'logistics'               THEN 'logistics'
  WHEN 'accounting'              THEN 'accounting'
  WHEN 'accountant'              THEN 'accounting'
  ELSE NULL
END
WHERE department IS NULL;

-- NOTE: no RLS change. `profiles` already has its policies; these are new columns on an
-- existing table, not a new user-facing table. Nothing here is sensitive in the
-- PF/vendor-price/margin sense — company_side/office/department/skills are directory
-- metadata that every internal user may read.
