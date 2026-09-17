-- 113_projects_prospect_link.sql — 2026-09-17
--
-- Marketing-only "Add Project" feature: marketing_pr can log a project Trust-Lines already
-- delivered for a Contact, purely as a historical record ("ben bu projeyi yaptım" — not a
-- new live pipeline item, not touched from Sales's own screens at all). Needed a way to find
-- these again from the Contact's own page, so `projects` gets a nullable back-reference —
-- every existing/normal project (created via Sales's acceptOpportunity flow) leaves this
-- NULL, unaffected.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_prospect_id ON projects (prospect_id) WHERE prospect_id IS NOT NULL;
