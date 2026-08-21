-- 030_lead_intake_documents.sql
-- Files attached during the Sales intake (scope notes images, plan/layout, photos).
-- The file bytes live in Dropbox (immutability rules apply — see lib/dropbox/
-- upload.ts: never delete, never overwrite, never move); this table only holds the
-- metadata + the dropbox_path pointer.
--
-- The 360 Matterport walkthrough is NOT a document — it is a URL kept in
-- lead_intake.matterport_link and never uploaded here.
--
-- Same Sales-only RLS boundary as lead_intake (migration 029): access is gated to
-- the owning sales_rep and any sales_marketing_manager via the parent row.

CREATE TABLE IF NOT EXISTS lead_intake_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_intake_id UUID NOT NULL REFERENCES lead_intake(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  dropbox_path   TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  uploaded_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_intake_documents_category_check CHECK (category IN (
    'shelving_note','millwork_note','image_note','ceiling_note',
    'areas_note','client_special_request_note','plan_layout','photos'
  ))
);

CREATE INDEX IF NOT EXISTS idx_lead_intake_documents_parent ON lead_intake_documents(lead_intake_id);

ALTER TABLE lead_intake_documents ENABLE ROW LEVEL SECURITY;

-- Access follows the parent lead_intake's ownership (owner rep OR any manager).
-- (Dropped first so this migration is safe to re-run.)
DROP POLICY IF EXISTS lead_intake_documents_sales_rw ON lead_intake_documents;
CREATE POLICY lead_intake_documents_sales_rw ON lead_intake_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lead_intake li
      WHERE li.id = lead_intake_id
        AND (
          li.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_intake li
      WHERE li.id = lead_intake_id
        AND (
          li.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
        )
    )
  );
