-- 029_lead_intake.sql
-- The persistent draft behind the Sales Meeting/Intake form. One row per lead
-- (1:1). Autosaved field-by-field while the rep fills it in; on "Deliver to
-- Trust-Lines" its data is copied onto the anchored draft project.
--
-- ANCHOR MODEL: leads are still a mock/UI concept (no leads table). The real
-- anchor is a draft `projects` row created on first autosave; lead_intake.project_id
-- FKs to it (UNIQUE 1:1). The originating mock lead id is kept as lead_ref TEXT
-- (no FK — there is nothing to reference yet).
--
-- ── SECURITY BOUNDARY (migration 025) ─────────────────────────────────────────
-- Only the owning sales_rep (created_by) and any sales_marketing_manager may read/
-- write. RLS is ENABLED and the ONLY policies granted are for those two roles, so
-- every internal Trust role (ops/exec/PM/production/finance) is DENIED by default
-- — they never see intake data, delivered or not. This table is NOT referenced by
-- any projects/documents policy; the Sales module stays fully isolated.

CREATE TABLE IF NOT EXISTS lead_intake (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  lead_ref        TEXT,                       -- originating mock lead id (no FK)
  region          TEXT,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  service_line    TEXT,
  project_number  INTEGER,                    -- number reserved from the sequence
  address         TEXT,
  scope_of_work   JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {shelving,millwork,image,ceiling: bool}
  notes           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {shelving,millwork,image,ceiling,areas,client_special_request: text}
  matterport_link TEXT,                        -- 360 walkthrough URL — NEVER touches Dropbox
  is_delivered    BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_intake_lead_ref ON lead_intake(lead_ref) WHERE lead_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_intake_created_by ON lead_intake(created_by);

ALTER TABLE lead_intake ENABLE ROW LEVEL SECURITY;

-- Owner sales_rep OR any sales_marketing_manager. Role read directly from
-- profiles.role (TEXT model — no user_role enum). Internal roles: no policy = deny.
-- (Dropped first so this migration is safe to re-run.)
DROP POLICY IF EXISTS lead_intake_sales_rw ON lead_intake;
CREATE POLICY lead_intake_sales_rw ON lead_intake
  FOR ALL
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
  );

DROP TRIGGER IF EXISTS trg_lead_intake_updated_at ON lead_intake;
CREATE TRIGGER trg_lead_intake_updated_at
  BEFORE UPDATE ON lead_intake FOR EACH ROW EXECUTE FUNCTION update_updated_at();
