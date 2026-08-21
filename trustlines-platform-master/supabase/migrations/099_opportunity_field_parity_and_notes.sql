-- 099_opportunity_field_parity_and_notes.sql — 2026-08-14
--
-- User request: the Opportunities NE detail screen should open in place (already true —
-- OpportunityQuickView.tsx) and be field-complete against the real ClickUp Deal task —
-- state/location/brand/industry/project type/request/to-do/direct-contact/description/
-- tags, plus the real comment thread (including a Matterport "bookmark" comment with its
-- own thumbnail preview, not just plain text). None of these were captured before.
--
-- The user's own example task ("Butler, 285 Chicora Rd, PA") is currently in the
-- "Potential" Status OP group, not a converted Opportunity — our import ALWAYS creates a
-- prospect_needs row regardless of outcome, and only conditionally an `opportunities` OR
-- `prospect_potentials` row on top of it (scripts/clickup-import-opportunities.mts).
-- Anchoring notes/files to `need_id` (present on both) covers both cases with one
-- mechanism, instead of needing a second, parallel `potential_notes`/`potential_files`
-- pair later.

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS business_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS industry_raw TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS project_type_raw TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS request_raw TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS to_do_raw TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS direct_contact_raw TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_raw_label TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_created_at TIMESTAMPTZ;
-- `description` already exists on opportunities and is the user-editable "Notes" field in
-- OpportunityQuickView — kept untouched by import. ClickUp's own raw task description
-- goes in its own column so the two never collide.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_description_raw TEXT;

-- Same field-parity set on prospect_potentials, for the (very common) case where the
-- ClickUp task's Status OP is still "Potential"/"In Target List" — everything above
-- minus the stage-machine-specific columns Opportunities alone has.
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS business_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS industry_raw TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS project_type_raw TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS request_raw TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS to_do_raw TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS direct_contact_raw TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS source_raw_label TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS source_description_raw TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS external_created_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS need_notes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id            UUID NOT NULL REFERENCES prospect_needs(id) ON DELETE CASCADE,
  author_name        TEXT,
  author_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body               TEXT NOT NULL,
  image_path         TEXT,               -- our own team's uploaded image (Dropbox), if any
  link_url           TEXT,               -- ClickUp "bookmark" comment (e.g. a Matterport tour)
  link_title         TEXT,
  link_thumbnail_url TEXT,
  source_created_at  TIMESTAMPTZ,
  external_source    TEXT,
  external_ref       TEXT,               -- ClickUp comment id
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_need_notes_dedupe
  ON need_notes (need_id, external_ref)
  WHERE external_source IS NOT NULL AND external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_need_notes_need ON need_notes (need_id, source_created_at DESC);

CREATE TABLE IF NOT EXISTS need_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id      UUID NOT NULL REFERENCES prospect_needs(id) ON DELETE CASCADE,
  dropbox_path TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_need_files_need ON need_files (need_id, created_at DESC);

ALTER TABLE need_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE need_files ENABLE ROW LEVEL SECURITY;

-- Mirrors prospect_needs' own RLS shape (migration 076-family): Marketing management
-- roles + Sales roles see everything; a marketing_pr sees what they created/own/are
-- assigned, via the parent Prospect (same EXISTS-join pattern as prospect_contacts).
DROP POLICY IF EXISTS need_notes_read ON need_notes;
CREATE POLICY need_notes_read ON need_notes
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs n
      JOIN prospects pr ON pr.id = n.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE n.id = need_notes.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS need_notes_write ON need_notes;
CREATE POLICY need_notes_write ON need_notes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs n
      JOIN prospects pr ON pr.id = n.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE n.id = need_notes.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs n
      JOIN prospects pr ON pr.id = n.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE n.id = need_notes.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS need_files_read ON need_files;
CREATE POLICY need_files_read ON need_files
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs n
      JOIN prospects pr ON pr.id = n.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE n.id = need_files.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS need_files_write ON need_files;
CREATE POLICY need_files_write ON need_files
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs n
      JOIN prospects pr ON pr.id = n.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE n.id = need_files.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (
      SELECT 1 FROM prospect_needs n
      JOIN prospects pr ON pr.id = n.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE n.id = need_files.need_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );
