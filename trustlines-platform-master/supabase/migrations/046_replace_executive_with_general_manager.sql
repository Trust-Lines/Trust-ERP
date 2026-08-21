-- 046_replace_executive_with_general_manager.sql
-- Role-model change (2026-07-10):
--   • `executive` is REMOVED/deprecated.
--   • `general_manager` REPLACES it and now holds FULL SYSTEM-WIDE authority.
--   • `ops_manager` keeps FULL Trust-Lines OPERATIONAL authority (unchanged).
--
-- Forward-only migration. Historical migrations 001/002/004/020 are NOT edited;
-- this file supersedes their `executive` references via CREATE OR REPLACE / DROP+CREATE.
--
-- ROLE STORAGE: profiles.role is TEXT in the live DB (no usable `user_role` enum —
-- see 023/025 history + AGENTS.md). Every predicate below compares role AS TEXT via
-- a direct `profiles` subquery (same pattern as 029/043/045). We deliberately do NOT
-- use auth_role() for the new checks and do NOT touch the `user_role` enum, so this
-- is safe whether or not `general_manager` was ever added to that enum.

-- ── 1. Migrate existing profiles: executive → general_manager ──
UPDATE profiles SET role = 'general_manager' WHERE role = 'executive';

-- ── 2. Ensure the general_manager role definition exists + gets FULL permissions ──
-- (No duplicate is created: 016 already inserted general_manager; we only guard-insert
--  then elevate its permissions to {"all":true} — the same grant `executive` had in 020.)
DO $$ BEGIN
  IF to_regclass('public.role_definitions') IS NOT NULL THEN
    INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
    SELECT 'general_manager', 'General Manager', 'Full system-wide authority (replaces executive)', '#ede9fe', '#7c3aed', true, '{"all":true}'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'general_manager');

    UPDATE role_definitions SET permissions = '{"all":true}'::jsonb WHERE name = 'general_manager';

    -- Remove the executive role definition ONLY now that no profile references it.
    DELETE FROM role_definitions
     WHERE name = 'executive'
       AND NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'executive');
  END IF;
END $$;

-- ── 3. RLS: replace the executive-scoped policies with general_manager ──
-- Recreated with a TEXT profiles subquery (no auth_role()/enum dependency). Behavior
-- preserved: ops_manager + general_manager get full project SELECT/UPDATE and audit read.

-- projects: full read (was policy "ops_exec_all" in 002)
DROP POLICY IF EXISTS "ops_exec_all" ON projects;
CREATE POLICY "ops_exec_all" ON projects
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager'))
  );

-- projects: update (was "ops_exec_update" in 002)
DROP POLICY IF EXISTS "ops_exec_update" ON projects;
CREATE POLICY "ops_exec_update" ON projects
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager'))
  );

-- audit_log: full read (was "ops_exec_audit" in 002)
DROP POLICY IF EXISTS "ops_exec_audit" ON audit_log;
CREATE POLICY "ops_exec_audit" ON audit_log
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager'))
  );

-- ── 4. is_internal_role(): drop executive, add general_manager ──
-- Return type unchanged (boolean) so CREATE OR REPLACE is valid. Rewritten to a TEXT
-- subquery so it is correct for general_manager regardless of the enum.
CREATE OR REPLACE FUNCTION is_internal_role()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN (
        'ops_manager','general_manager','pm_millwork','pm_ceiling',
        'trustlines_pm','qc_responsible','logistics','accounting'
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- NOTE: auth_role() (002) is intentionally left untouched — the untouched policies
-- that still call it reference only enum-valid roles. New/changed checks above avoid it.
