-- 031_projects_draft_rls.sql
-- Keep undelivered Sales drafts out of Trust's normal Projects views WITHOUT
-- touching any existing projects policy.
--
-- Existing per-role SELECT policies on projects are PERMISSIVE (OR-ed together).
-- We add ONE RESTRICTIVE policy, which Postgres AND-s with whatever permissive
-- policy already granted the row. Net effect: a row is visible only if it also
-- passes this filter — i.e. it is NOT an undelivered draft.
--
-- Notes:
--   • Service-role (admin) clients bypass RLS entirely, so the Sales intake API
--     routes still read/write their draft freely. The AI assistant also uses the
--     service role, so drafts are additionally filtered there in code
--     (assistantTools.ts, `is_draft = false`).
--   • Delivered projects have is_draft = false and pass this filter normally.

DROP POLICY IF EXISTS projects_hide_undelivered_drafts ON projects;
CREATE POLICY projects_hide_undelivered_drafts ON projects
  AS RESTRICTIVE
  FOR SELECT
  USING (NOT (is_draft = true AND delivered_to_trust_at IS NULL));
