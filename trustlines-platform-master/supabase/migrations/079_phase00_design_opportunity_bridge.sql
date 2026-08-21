-- 079_phase00_design_opportunity_bridge.sql — let an Opportunity-sourced Project reuse
-- the SAME Design module (sales_design_jobs) that lead_intake-sourced projects already
-- use, instead of building a second, parallel Design system.
--
-- sales_design_jobs.lead_intake_id was NOT NULL — the table only ever anchored to
-- lead_intake. An Opportunity-sourced project (Phase 00, migrations 072-078) has NO
-- lead_intake row at all (deliberate 2026-07-22 boundary: Marketing never creates a
-- lead_intake/project — only Sales Accept does, straight from `opportunities`). So the
-- table becomes DUAL-ANCHOR: exactly one of lead_intake_id / opportunity_id is set.
-- RLS (051) is purely role-based / assigned_designer_id-based, never joins lead_intake —
-- no RLS change needed here.

ALTER TABLE sales_design_jobs ALTER COLUMN lead_intake_id DROP NOT NULL;
ALTER TABLE sales_design_jobs ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE;

ALTER TABLE sales_design_jobs DROP CONSTRAINT IF EXISTS sales_design_jobs_one_anchor_check;
ALTER TABLE sales_design_jobs ADD CONSTRAINT sales_design_jobs_one_anchor_check
  CHECK ((lead_intake_id IS NOT NULL) <> (opportunity_id IS NOT NULL));

-- Re-scope the existing one-job-per-lead index to lead-anchored rows only, and add the
-- Opportunity-side equivalent — both partial, so NULLs on the other anchor never collide.
DROP INDEX IF EXISTS idx_sdj_one_per_lead;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdj_one_per_lead
  ON sales_design_jobs(lead_intake_id) WHERE lead_intake_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdj_one_per_opportunity
  ON sales_design_jobs(opportunity_id) WHERE opportunity_id IS NOT NULL AND deleted_at IS NULL;
