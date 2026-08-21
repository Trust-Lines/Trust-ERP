-- 019_assembly_links.sql
-- Assembly relationships captured from the PF "ASSEMBLY" action: which item(s) of
-- one PF mount onto which item(s) of another PF (within the same project).

CREATE TABLE IF NOT EXISTS assembly_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            TEXT,                       -- board type the action came from (Millwork…)
  source_pf_code  TEXT,                       -- the PF the action was taken on
  source_items    JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{code, description}]
  target_pf_code  TEXT,                       -- the PF the source mounts onto
  target_items    JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{code, description}]
  note            TEXT,                       -- describes how it mounts
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assembly_links_project ON assembly_links(project_id);

ALTER TABLE assembly_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assembly_links_select ON assembly_links;
CREATE POLICY assembly_links_select ON assembly_links
  FOR SELECT TO authenticated USING (true);
