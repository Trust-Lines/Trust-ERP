-- 095_prospect_files_and_writable_notes.sql — 2026-08-13
--
-- User request: the Prospect 360 "Files" tab ("File attachments are not built yet") and
-- the Activity panel (previously read-only, ClickUp-imported comments only) both need to
-- become real: files can be attached, and our own team can post comments — with images —
-- the same way ClickUp's comment thread works. Files go to Dropbox (GET-only rule from
-- lib/clickup/client.ts is about ClickUp, not Dropbox — Dropbox writes are fine, this app
-- already uploads there elsewhere; the AGENTS.md rule is: never delete/move/overwrite,
-- which lib/dropbox/upload.ts's mode:'add' + autorename already guarantees).

CREATE TABLE IF NOT EXISTS prospect_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id   UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  dropbox_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  uploaded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prospect_files_prospect ON prospect_files (prospect_id, created_at DESC);

ALTER TABLE prospect_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospect_files_read ON prospect_files;
CREATE POLICY prospect_files_read ON prospect_files
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_files.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_files_write ON prospect_files;
CREATE POLICY prospect_files_write ON prospect_files
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_files.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_files.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

-- prospect_contact_notes (migration 092) was read-only/import-only until now — widen it
-- to also hold real, user-authored comments: author_id (who actually posted it, distinct
-- from author_name which for a ClickUp-imported row is just a display-name snapshot) and
-- an optional attached image.
ALTER TABLE prospect_contact_notes ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE prospect_contact_notes ADD COLUMN IF NOT EXISTS image_path TEXT;
