-- 070_phase00_marketing_roles.sql — PHASE 00.2 Marketing Roles
--
-- WHY THIS MIGRATION IS MANDATORY (not a convenience — same reason as 065):
--   lib/permissions/catalog.ts effectivePermissions() returns the STORED map WHOLE, it
--   does NOT merge per-key onto DEFAULT_PERMISSIONS. A role with no role_definitions row
--   falls back to the code default (fine for a brand-new role like this one), but the Roles
--   UI cannot see/edit it without a row, and a future permission tweak in catalog.ts would
--   silently do nothing once this row exists. Seed it now so both paths agree from day one.
--
-- Foundation only (PHASE-00-MARKETING-LEAD-OPPORTUNITY-ORIGINATION.md §00.2): no
-- Prospect/Potential/Opportunity table exists yet (00.3/00.4/00.5). This migration adds
-- ONLY the two roles + their permissions — nothing else.
--
-- Role model (CLAUDE.md / AGENTS.md): profiles.role is TEXT. There is NO `user_role` enum
-- in the live DB — never ALTER TYPE. Roles live in role_definitions.name (TEXT).
--
-- Idempotent / re-runnable: guarded INSERT ... WHERE NOT EXISTS.

DO $$ BEGIN
IF to_regclass('public.role_definitions') IS NULL THEN
  RAISE NOTICE '070: role_definitions missing — skipping';
  RETURN;
END IF;

-- marketing_pr — capture/enrich/nurture/qualify + hand off to Sales. Own records only
-- (RLS scoping arrives with the Prospect table in 00.3). No page.projects: cannot create
-- a project, reserve a project number, or touch Dropbox. No PF/prices/PO/production/
-- suppliers/expenses surface.
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'marketing_pr', 'Marketing & PR', 'Prospect/Potential capture, nurture, qualification and Sales handoff', '#fce7f3', '#be185d', true,
       '{"page.dashboard":true,"page.marketing":true,"page.notifications":true,"page.settings":true,"edit.marketing":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'marketing_pr');

-- marketing_manager — sees/manages ALL Marketing records, assigns owners, overrides
-- classification, approves/initiates handoff. Cannot accept on Sales' behalf, cannot
-- close won, cannot create a project. Same page/edit surface as marketing_pr — the
-- "all records" vs "own records" distinction is a data-scope (RLS) concern from 00.3
-- onward, not a separate permission key (mirrors design_lead vs designer).
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'marketing_manager', 'Marketing Manager', 'Owns all Marketing records, campaigns/events, classification overrides and handoff approval', '#fbcfe8', '#9d174d', true,
       '{"page.dashboard":true,"page.marketing":true,"page.notifications":true,"page.settings":true,"edit.marketing":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'marketing_manager');

END $$;
