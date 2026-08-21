-- 085_need_documents_early_project.sql — CRM Faz 5 (2026-08-11)
--
-- New classification rule: the ONLY signal that promotes a prospect_need to Opportunity
-- is a real attached document/link (layout file, photo, Matterport link, reference
-- link) — see lib/marketing/classification.ts. The old field-based signals (deadline
-- set / project type known / active project / layout Yes-No) no longer classify on
-- their own; those columns are UNCHANGED here, kept as informational fields.
--
-- Explicit, fully-informed user decision (2026-08-11): the moment a Need gets its first
-- document/link and thereby becomes an Opportunity, a REAL global project number +
-- REAL Dropbox project folder are created immediately — reversing the 2026-07-22 "no
-- project/Dropbox until Sales accepts" rule for this path specifically. The user was
-- told this burns a permanent project number and creates a permanent Dropbox folder
-- even for a Need that never converts, and confirmed anyway.
--
-- Doing that requires the same 5 fields app/api/leads/[id]/intake/route.ts's "Block 1"
-- gate requires (region, service_line, customer_name, city, state). Marketing capture
-- already has customer_name (prospects.organization_name/person_name) and city
-- (prospect_locations.city), but NEVER collected region/service_line, and never asked
-- for state — added here at the Need level (a Need, not the parent Prospect, is what
-- becomes a Project, since one Prospect can have several Needs in different regions).

ALTER TABLE prospect_needs ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE prospect_needs DROP CONSTRAINT IF EXISTS prospect_needs_region_check;
ALTER TABLE prospect_needs ADD  CONSTRAINT prospect_needs_region_check
  CHECK (region IS NULL OR region IN ('TLINES_NE', 'TLINES_SE', 'TLINES_NW', 'CVW'));

ALTER TABLE prospect_needs ADD COLUMN IF NOT EXISTS service_line TEXT;
ALTER TABLE prospect_needs DROP CONSTRAINT IF EXISTS prospect_needs_service_line_check;
ALTER TABLE prospect_needs ADD  CONSTRAINT prospect_needs_service_line_check
  CHECK (service_line IS NULL OR service_line IN ('store_maker', 'premium_store_fitout', 'design_build'));

ALTER TABLE prospect_needs ADD COLUMN IF NOT EXISTS state TEXT;

-- Links a Need to the real Project created the moment it first qualifies as an
-- Opportunity via document evidence (lib/marketing/needDocuments.ts's
-- ensureProjectForNeed()) — mirrors lead_intake.project_id's shape/guard exactly.
ALTER TABLE prospect_needs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_needs_one_project
  ON prospect_needs (project_id) WHERE project_id IS NOT NULL;

-- ── Documents/links attached to a Need — the classification evidence itself ─────────
CREATE TABLE IF NOT EXISTS prospect_need_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id      UUID NOT NULL REFERENCES prospect_needs(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('layout', 'photo', 'matterport', 'link')),
  -- layout/photo: a real file, uploaded straight to Dropbox (never Supabase Storage).
  dropbox_path TEXT,
  file_name    TEXT,
  -- matterport/link: just a URL — a Matterport tour or any reference link is not a file.
  url          TEXT,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (category IN ('layout', 'photo')     AND dropbox_path IS NOT NULL AND url IS NULL) OR
    (category IN ('matterport', 'link')  AND url IS NOT NULL AND dropbox_path IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_prospect_need_documents_need ON prospect_need_documents (need_id);

-- ── RLS — same shape as prospect_needs (076), now written directly with ops_manager in
-- the manager tier from the start (see migration 084's MARKETING_MANAGE_ROLES widening).
ALTER TABLE prospect_need_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospect_need_documents_read ON prospect_need_documents;
CREATE POLICY prospect_need_documents_read ON prospect_need_documents
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs pn
      JOIN prospects pr ON pr.id = pn.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pn.id = prospect_need_documents.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_need_documents_write ON prospect_need_documents;
CREATE POLICY prospect_need_documents_write ON prospect_need_documents
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs pn
      JOIN prospects pr ON pr.id = pn.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pn.id = prospect_need_documents.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs pn
      JOIN prospects pr ON pr.id = pn.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pn.id = prospect_need_documents.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );
