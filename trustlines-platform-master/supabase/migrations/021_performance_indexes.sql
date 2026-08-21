-- 021_performance_indexes.sql
-- Indexes for the hot query paths so the app stays fast as the company scales to
-- ~1000 projects and tens of thousands of documents/approvals. Postgres does NOT
-- auto-index foreign keys, so these matter a lot once the tables grow.
--
-- Run once in the Supabase SQL editor. CREATE INDEX IF NOT EXISTS is idempotent.
-- (If a table is already large, prefer running each statement with CONCURRENTLY
--  outside a transaction to avoid write locks.)

-- ── document_approvals — currently UNINDEXED; queried by document_id everywhere ──
CREATE INDEX IF NOT EXISTS idx_doc_approvals_document
  ON document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_approvals_doc_stage
  ON document_approvals(document_id, stage);
-- "My Approvals" + guards: pending rows, and rows assigned to a user.
CREATE INDEX IF NOT EXISTS idx_doc_approvals_status
  ON document_approvals(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_doc_approvals_assigned
  ON document_approvals(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_doc_approvals_project_status
  ON document_approvals(project_id, status);

-- ── documents — add cat_group-aware lookup + path/status filters ───────────────
-- (idx_documents_project_type already covers project_id, doc_type, status.)
CREATE INDEX IF NOT EXISTS idx_documents_project_cat_type
  ON documents(project_id, doc_type, cat_group);
CREATE INDEX IF NOT EXISTS idx_documents_project_status
  ON documents(project_id, status);
-- check-revisions / link-file resolve by Dropbox path.
CREATE INDEX IF NOT EXISTS idx_documents_dropbox_path
  ON documents(dropbox_path);

-- ── production_items — board + pf-status filter by (project, type) ─────────────
CREATE INDEX IF NOT EXISTS idx_production_items_project_type
  ON production_items(project_id, type) WHERE deleted_at IS NULL;

-- ── assembly_links / role lookups ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_role_definitions_name
  ON role_definitions(name);
