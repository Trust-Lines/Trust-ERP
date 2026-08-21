-- 051_sales_design.sql
-- Phase 2 — Sales Design (PROJECT-MASTER-PLAN §4.2).
--
-- RE-RUNNABLE. An earlier draft of this same file (with `assigned_to`/`assigned_team`
-- and the old status set) may already have been applied. This version is idempotent
-- and self-healing: it creates the tables when absent, and migrates them in place when
-- the earlier draft is present. Safe to run from any state, any number of times.
-- Migrations 045–050 are applied and untouched.
--
-- BUSINESS RULE: a design job is NOT created when a lead is first entered. The lead
-- moves along the Sales board; when `lead_intake.opportunity_status` becomes
-- 'working_on_it_trust' ("Working on it Trust") the system creates exactly ONE design
-- job for that lead (see lib/sales/design.ts → ensureDesignJobForLead). It starts in
-- `awaiting_assignment` until Sales assigns a real designer person.
--
--   sales_design_jobs     — one job per lead (assignment + status).
--   sales_design_versions — the draft versions of a job (present / revise cycle).
--
-- Assignment is to a PERSON (`assigned_designer_id` → profiles), never to an office
-- string. The designer's office lives on `profiles.office` (added below), so the UI
-- can render "Sara Khaled — Syria Office" while storing only the profile id.

-- ── Designer support on the user profile ──────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS office TEXT;   -- e.g. 'Trust Lines Türkiye', 'Syria Office'

-- Register the `designer` role (role_definitions is the role source of truth;
-- profiles.role is TEXT — never touch the nonexistent user_role enum).
DO $$ BEGIN
  IF to_regclass('public.role_definitions') IS NOT NULL THEN
    INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
    SELECT 'designer', 'Designer', 'Sales Design team member — sees design jobs assigned to them (no finance/PF/vendor data).',
           '#e0f2fe', '#0369a1', true, '{"page.dashboard":true}'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'designer');
  END IF;
END $$;

-- ── SALES DESIGN JOBS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_design_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_intake_id      UUID NOT NULL REFERENCES lead_intake(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,   -- copied from the lead when known
  title               TEXT NOT NULL,
  brief               TEXT,
  assigned_designer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,   -- a PERSON, never an office
  status              TEXT NOT NULL DEFAULT 'awaiting_assignment',
  priority            TEXT NOT NULL DEFAULT 'normal',                     -- low|normal|high
  due_date            DATE,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_archived         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── HEAL: an earlier draft of THIS migration shipped `assigned_to` / `assigned_team`
-- and the old status set. If that draft was already applied, `CREATE TABLE IF NOT
-- EXISTS` above is a no-op, so bring the existing table up to the corrected shape.
-- All steps are guarded, so this file is safe to re-run from any state.
DO $$
BEGIN
  -- assigned_to → assigned_designer_id (assignment is to a PERSON)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'sales_design_jobs' AND column_name = 'assigned_to')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'sales_design_jobs' AND column_name = 'assigned_designer_id')
  THEN
    ALTER TABLE sales_design_jobs RENAME COLUMN assigned_to TO assigned_designer_id;
  END IF;
END $$;

-- Office is never an assignee: it lives on profiles.office.
ALTER TABLE sales_design_jobs DROP COLUMN IF EXISTS assigned_team;

-- Columns the corrected schema adds (no-ops when the table was just created).
ALTER TABLE sales_design_jobs ADD COLUMN IF NOT EXISTS assigned_designer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE sales_design_jobs ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE sales_design_jobs ALTER COLUMN status SET DEFAULT 'awaiting_assignment';

-- Remap any rows written under the old status set BEFORE re-adding the CHECK.
-- (Drop the constraint first: a half-applied run may already have added it.)
ALTER TABLE sales_design_jobs DROP CONSTRAINT IF EXISTS sales_design_jobs_status_check;

UPDATE sales_design_jobs SET status = CASE status
  WHEN 'draft'       THEN 'awaiting_assignment'
  WHEN 'in_progress' THEN 'working_on_it'
  WHEN 'submitted'   THEN 'ready_for_sales_review'
  WHEN 'in_review'   THEN 'ready_for_sales_review'
  WHEN 'approved'    THEN 'approved_by_sales'
  WHEN 'closed'      THEN 'completed'
  ELSE status
END
WHERE status IN ('draft', 'in_progress', 'submitted', 'in_review', 'approved', 'closed');

ALTER TABLE sales_design_jobs ADD CONSTRAINT sales_design_jobs_status_check
  CHECK (status IN (
    'awaiting_assignment', 'assigned', 'working_on_it', 'ready_for_sales_review',
    'revision_requested', 'approved_by_sales', 'presented_to_customer', 'completed', 'cancelled'
  ));

-- Retire indexes from the earlier draft, then build the corrected set.
DROP INDEX IF EXISTS idx_sdj_lead;
DROP INDEX IF EXISTS idx_sdj_assigned;

-- Exactly ONE live design job per lead — makes the status trigger idempotent even
-- under a race (re-selecting 'Working on it Trust' cannot create a duplicate).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdj_one_per_lead ON sales_design_jobs(lead_intake_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sdj_designer ON sales_design_jobs(assigned_designer_id);
CREATE INDEX IF NOT EXISTS idx_sdj_customer ON sales_design_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_sdj_status   ON sales_design_jobs(status) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_sdj_updated_at ON sales_design_jobs;
CREATE TRIGGER trg_sdj_updated_at BEFORE UPDATE ON sales_design_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── SALES DESIGN VERSIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_design_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES sales_design_jobs(id) ON DELETE CASCADE,
  version_no        INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft', -- draft|submitted|presented|approved|revision_requested|rejected
  preview_link      TEXT,                          -- external link (Dropbox / Drive / Matterport) — no file upload here
  notes             TEXT,
  presented_at      TIMESTAMPTZ,
  customer_feedback TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sdv_job_version ON sales_design_versions(job_id, version_no);
CREATE INDEX IF NOT EXISTS idx_sdv_job ON sales_design_versions(job_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE sales_design_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_design_versions ENABLE ROW LEVEL SECURITY;

-- Read: the assigned designer, or sales/ops/gm/PM. Write: sales + ops/gm, or the
-- assigned designer on their own job (they progress it / add versions).
DROP POLICY IF EXISTS sdj_read ON sales_design_jobs;
CREATE POLICY sdj_read ON sales_design_jobs
  FOR SELECT USING (
    assigned_designer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
               AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager','trustlines_pm','tlines_pm'))
  );

DROP POLICY IF EXISTS sdj_write ON sales_design_jobs;
CREATE POLICY sdj_write ON sales_design_jobs
  FOR ALL USING (
    assigned_designer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
               AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
  ) WITH CHECK (
    assigned_designer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
               AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
  );

DROP POLICY IF EXISTS sdv_read ON sales_design_versions;
CREATE POLICY sdv_read ON sales_design_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager','trustlines_pm','tlines_pm'))
    OR EXISTS (SELECT 1 FROM sales_design_jobs j WHERE j.id = job_id AND j.assigned_designer_id = auth.uid())
  );

DROP POLICY IF EXISTS sdv_write ON sales_design_versions;
CREATE POLICY sdv_write ON sales_design_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (SELECT 1 FROM sales_design_jobs j WHERE j.id = job_id AND j.assigned_designer_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (SELECT 1 FROM sales_design_jobs j WHERE j.id = job_id AND j.assigned_designer_id = auth.uid())
  );
