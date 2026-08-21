-- 065_phase11_role_catalog.sql — PHASE 11.1 Role Catalog
--
-- WHY THIS MIGRATION IS MANDATORY (not a convenience):
--   lib/permissions/catalog.ts effectivePermissions() returns the STORED map WHOLE —
--   it does NOT merge per-key onto DEFAULT_PERMISSIONS:
--       if (stored && Object.keys(stored).length) return stored;
--   Every role below already has a stored role_definitions.permissions map, so changing
--   the TypeScript default grants/revokes NOTHING in production. The code change and this
--   seed must land TOGETHER. See AUDIT_PHASE11_ROLES.md §1.4-C.
--
-- Role model (CLAUDE.md / AGENTS.md): profiles.role is TEXT. There is NO `user_role` enum
-- in the live DB — never ALTER TYPE. Roles live in role_definitions.name (TEXT).
--
-- Idempotent / re-runnable: guarded INSERT ... WHERE NOT EXISTS + jsonb key deletes.

DO $$ BEGIN
IF to_regclass('public.role_definitions') IS NULL THEN
  RAISE NOTICE '065: role_definitions missing — skipping';
  RETURN;
END IF;

-- ── 1. 🔴 SECURITY FIX: strip internal-cost keys from `tlines_pm` ───────────────────
-- Phase 11 §7 + the CLAUDE.md immutable rule: a T-Lines PM never sees PF, vendor
-- purchase price, internal cost or margin. The live seed granted view.pf + view.prices
-- + view.production_board because catalog.ts's VIEW_ALL_TABS used to CONTAIN view.pf/po
-- and every PM default spread it. Root cause fixed in code; this repairs live data.
--
-- `view.po` is deliberately KEPT: master plan §4.6 lists "the PO sent to T-Lines" as
-- visible to them, and they sign the Client PM box on the PO — removing it would hide
-- the PO tab (CategoryTab gates it on view.po) and BREAK PO approval.
UPDATE role_definitions
   SET permissions = (permissions - 'view.pf' - 'view.prices' - 'view.production_board')
 WHERE name = 'tlines_pm'
   AND permissions IS NOT NULL
   AND permissions->>'all' IS DISTINCT FROM 'true';

-- ── 2. Delete the orphan `pm__image` role definition ────────────────────────────────
-- Double-underscore typo, 0 profiles, absent from the UserRole union, and its permission
-- vocabulary is pre-020 (nav.* / docs.* / proj_tab.*). Guarded on zero references.
DELETE FROM role_definitions
 WHERE name = 'pm__image'
   AND NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'pm__image');

-- ── 3. Seed the missing `accounting` role definition ────────────────────────────────
-- It is in the UserRole union and DEFAULT_PERMISSIONS, so the code fallback keeps it
-- working — but with no row the DB-driven Roles UI cannot see or edit it.
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'accounting', 'Accounting', 'Finance / accounting (PO, PF, prices, payments)', '#fef3c7', '#b45309', true,
       '{"page.dashboard":true,"page.projects":true,"page.approvals":true,"page.notifications":true,"page.settings":true,"page.production":true,"page.suppliers":true,"page.expenses":true,"sign.accountant":true,"view.tab_overview":true,"view.po":true,"view.pf":true,"view.prices":true,"view.production_board":true,"progress.production":true,"progress.delivery":true,"notify.payment":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'accounting');

-- ── 4. Phase 11 §2 roles that do not exist yet ──────────────────────────────────────
-- DECISIONS (user-approved 2026-07-16, recorded in PHASE-11-...md §11.1):
--   • Designer stays ONE role; discipline is a SKILL (skills[] → 11.2). The 7 designer
--     roles in §2 are NOT created. design_lead / shop_drawer ARE roles: different
--     AUTHORITY, not different discipline.
--   • pm_supervisor is NOT added as a role — profiles.is_pm_supervisor stays (the PO
--     supervisor signature box reads it). Additive only.
--   • luxury_pm is DEFERRED — scope undefined; an under-specified role gets over-granted.
--   • pm_millwork / pm_ceiling / project_manager are KEPT (live + PF/PO signature chain).

-- design_lead — the whole design queue + assignment authority. No PF/vendor/margin.
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'design_lead', 'Design Lead', 'Owns the design queue and designer assignment', '#e0e7ff', '#4338ca', true,
       '{"page.dashboard":true,"page.design":true,"page.projects":true,"page.customers":true,"page.notifications":true,"page.settings":true,"view.tab_overview":true,"view.tab_plan_layout":true,"view.tab_design_proposal":true,"view.tab_construction":true,"progress.finalization":true,"progress.construction":true,"notify.approval_request":true,"notify.revision":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'design_lead');

-- shop_drawer — technical / shop drawings. No PF/vendor/margin.
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'shop_drawer', 'Shop Drawer', 'Technical / shop drawings', '#ccfbf1', '#0f766e', true,
       '{"page.dashboard":true,"page.design":true,"page.projects":true,"page.notifications":true,"page.settings":true,"view.tab_overview":true,"view.tab_construction":true,"view.tab_millwork":true,"view.tab_shelving":true,"progress.construction":true,"notify.approval_request":true,"notify.revision":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'shop_drawer');

-- supply_manager — Trust-Lines internal, full internal-cost visibility.
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'supply_manager', 'Supply Manager', 'Trust-Lines supply: types, vendors, PF/PO, pricing', '#dbeafe', '#1d4ed8', true,
       '{"page.dashboard":true,"page.projects":true,"page.approvals":true,"page.notifications":true,"page.settings":true,"page.clients":true,"page.customers":true,"page.production":true,"page.qc":true,"page.suppliers":true,"page.expenses":true,"edit.projects":true,"edit.production":true,"view.tab_overview":true,"view.tab_plan_layout":true,"view.tab_design_proposal":true,"view.tab_construction":true,"view.tab_millwork":true,"view.tab_shelving":true,"view.tab_ceiling":true,"view.tab_image":true,"view.tab_decoration":true,"view.pf":true,"view.po":true,"view.production_board":true,"view.prices":true,"progress.finalization":true,"progress.construction":true,"progress.production":true,"progress.delivery":true,"notify.approval_request":true,"notify.approval_complete":true,"notify.revision":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'supply_manager');

-- supply_user — supply team member (no pricing/margin surface).
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'supply_user', 'Supply User', 'Supply team member (no margin/pricing surface)', '#dbeafe', '#2563eb', true,
       '{"page.dashboard":true,"page.projects":true,"page.approvals":true,"page.notifications":true,"page.settings":true,"page.production":true,"page.suppliers":true,"edit.production":true,"view.tab_overview":true,"view.tab_plan_layout":true,"view.tab_design_proposal":true,"view.tab_construction":true,"view.tab_millwork":true,"view.tab_shelving":true,"view.tab_ceiling":true,"view.tab_image":true,"view.tab_decoration":true,"view.pf":true,"view.po":true,"view.production_board":true,"progress.production":true,"notify.approval_request":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'supply_user');

-- production_user — production floor member.
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'production_user', 'Production User', 'Production team member', '#fee2e2', '#b91c1c', true,
       '{"page.dashboard":true,"page.projects":true,"page.approvals":true,"page.notifications":true,"page.settings":true,"page.production":true,"edit.production":true,"view.tab_overview":true,"view.tab_millwork":true,"view.tab_shelving":true,"view.tab_ceiling":true,"view.tab_image":true,"view.tab_decoration":true,"view.pf":true,"view.production_board":true,"progress.production":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'production_user');

-- warehouse_manager / warehouse_user — receiving + dispatch.
-- Phase 11 §7: warehouse sees NO margin, NO customer private comms, NO sales pipeline.
INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'warehouse_manager', 'Warehouse Manager', 'Receiving, quantity verification, dispatch', '#f3e8ff', '#7e22ce', true,
       '{"page.dashboard":true,"page.projects":true,"page.approvals":true,"page.notifications":true,"page.settings":true,"page.production":true,"page.logistics":true,"edit.production":true,"view.tab_overview":true,"view.production_board":true,"progress.production":true,"progress.delivery":true,"notify.ready":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'warehouse_manager');

INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
SELECT 'warehouse_user', 'Warehouse User', 'Warehouse team member', '#f3e8ff', '#9333ea', true,
       '{"page.dashboard":true,"page.projects":true,"page.approvals":true,"page.notifications":true,"page.settings":true,"page.production":true,"page.logistics":true,"view.tab_overview":true,"view.production_board":true,"progress.delivery":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = 'warehouse_user');

END $$;
