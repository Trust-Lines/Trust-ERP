-- Migration 013: Version sets (document_versions)
-- Canonical versioning model:
--   * DRAFT ends when Trust PM signs (status draft → signed).
--   * A new version opens ONLY when Client PM rejects (status → rejected, next set created).
--   * Production bundle docs (item_plan/item_list/price_list/book/po_bo/pf) within one
--     category share ONE version set. Construction drawings have their own scope.
--   * Version numbering is 0-based for these scopes.

CREATE TABLE IF NOT EXISTS document_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope                 TEXT NOT NULL,  -- 'construction_drawing' | category code ('ceiling','millwork','image','shelving',…)
  version_number        INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','signed','completed','rejected')),
  opened_reason         TEXT NOT NULL DEFAULT 'initial'
                        CHECK (opened_reason IN ('initial','client_pm_rejection')),
  dropbox_folder_path   TEXT,
  dropbox_rev           TEXT,
  dropbox_modified_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  signed_by_trust_pm_at TIMESTAMPTZ,
  client_pm_decided_at  TIMESTAMPTZ,
  client_pm_decision    TEXT CHECK (client_pm_decision IN ('approved','rejected')),
  UNIQUE (project_id, scope, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_scope
  ON document_versions(project_id, scope, version_number DESC);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS version_set_id UUID REFERENCES document_versions(id);

-- RLS: same pattern as documents — all authenticated users can read; writes via service role
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_versions_select ON document_versions;
CREATE POLICY document_versions_select ON document_versions
  FOR SELECT TO authenticated USING (true);

-- Realtime: the UI subscribes to these tables so revisions/approvals refresh live
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE document_versions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE documents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE document_approvals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
