-- 054_sales_design_files.sql
-- Phase 2 — close the Sales ⇄ Designer loop.
--
-- The Sales rep already collects the customer's files during intake
-- (`lead_intake_documents`: plan_layout, photos, *_note) plus the 360 walkthrough URL
-- (`lead_intake.matterport_link`). Those are the designer's INPUT — the design
-- workspace now reads them straight off the lead, no copying.
--
-- This migration adds the missing OUTPUT side: the files a designer uploads for a
-- design version, which Sales then sees on the lead.
--
-- Bytes live in Dropbox (immutability rules: add-mode + autorename, never overwrite /
-- delete / move); this table only holds metadata + the dropbox_path pointer, exactly
-- like lead_intake_documents / documents.

CREATE TABLE IF NOT EXISTS sales_design_version_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   UUID NOT NULL REFERENCES sales_design_versions(id) ON DELETE CASCADE,
  job_id       UUID NOT NULL REFERENCES sales_design_jobs(id) ON DELETE CASCADE,  -- denormalised for scoping/RLS
  dropbox_path TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdvf_version ON sales_design_version_files(version_id);
CREATE INDEX IF NOT EXISTS idx_sdvf_job     ON sales_design_version_files(job_id);

ALTER TABLE sales_design_version_files ENABLE ROW LEVEL SECURITY;

-- Same boundary as sales_design_versions (051): Sales/ops/gm/PM read; Sales/ops/gm
-- write, and the assigned designer reads+writes their OWN job's files.
DROP POLICY IF EXISTS sdvf_read ON sales_design_version_files;
CREATE POLICY sdvf_read ON sales_design_version_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager','trustlines_pm','tlines_pm'))
    OR EXISTS (SELECT 1 FROM sales_design_jobs j WHERE j.id = job_id AND j.assigned_designer_id = auth.uid())
  );

DROP POLICY IF EXISTS sdvf_write ON sales_design_version_files;
CREATE POLICY sdvf_write ON sales_design_version_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (SELECT 1 FROM sales_design_jobs j WHERE j.id = job_id AND j.assigned_designer_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
    OR EXISTS (SELECT 1 FROM sales_design_jobs j WHERE j.id = job_id AND j.assigned_designer_id = auth.uid())
  );
