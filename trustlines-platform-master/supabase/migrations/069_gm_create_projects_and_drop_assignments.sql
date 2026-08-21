-- 069 — two independent this-session fixes.
--
-- Role model: profiles.role is TEXT in the live DB; there is no `user_role` enum. The
-- policies below use a TEXT subquery (the same shape migration 046 used) so they are
-- correct regardless of the enum, and do NOT call auth_role() (which returns the enum
-- type and only knows enum-valid values).
--
-- Idempotent / re-runnable.

-- ── 1. 🔴 BUG: general_manager could not CREATE a project ──────────────────────
-- 002's INSERT policy was `WITH CHECK (auth_role() = 'ops_manager')` — general_manager,
-- which is full system-wide authority, was excluded, so a GM hit
-- "new row violates row-level security policy for table projects". 046 rewrote the
-- SELECT/UPDATE project policies for general_manager but LEFT the INSERT one behind.
DROP POLICY IF EXISTS "ops_create" ON projects;
CREATE POLICY "ops_create" ON projects
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ops_manager', 'general_manager')
  );

-- ── 2. Remove the manual assignment model (Phase 11.3, migration 067) ──────────
-- Superseded by the DERIVED team (Phase 11.4b): "who is on a project" is now computed
-- from the fixed PM columns + each person's skills[]/department matched against the
-- project's types (lib/team/derive.ts). No table backs it, so 067's table, its policies
-- and indexes are dropped. CASCADE removes the dependent policies/indexes with it.
DROP TABLE IF EXISTS project_assignments CASCADE;
