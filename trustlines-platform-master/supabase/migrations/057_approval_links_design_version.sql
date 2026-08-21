-- 057_approval_links_design_version.sql
-- Phase 5 — let an external review link target a Sales Design VERSION (not only a
-- production `document`). This closes the design loop: Sales shares a design version
-- with the customer via a secure link; the customer's decision flows back to the
-- version + job (approve → the project moves to Supply).
--
-- Additive nullable column. The public route decides what to show by which id is set:
--   document_id            → a production document
--   sales_design_version_id→ a Sales Design version (preview + uploaded files)

ALTER TABLE approval_links ADD COLUMN IF NOT EXISTS sales_design_version_id UUID REFERENCES sales_design_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_al_design_version ON approval_links(sales_design_version_id);
