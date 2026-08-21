-- 052_design_workspace_permissions.sql
-- Phase 2 — grant the Design workspace page (`/design`) permission key.
--
-- These roles carry STORED permission maps (051 seeded `designer` with
-- {"page.dashboard":true}; 026 seeded the sales roles), so the catalog.ts
-- DEFAULT_PERMISSIONS fallback never applies to them — the keys must be merged into
-- role_definitions.permissions directly. Merge is idempotent (jsonb `||`).
--
-- ops_manager / general_manager already hold {"all":true} → skipped.
--   • designer                          : page.design + the basics they need to log in and work
--   • sales_rep, sales_marketing_manager: page.design (they watch the design queue)

DO $$ BEGIN
  IF to_regclass('public.role_definitions') IS NOT NULL THEN
    UPDATE role_definitions
       SET permissions = permissions || '{"page.design":true,"page.notifications":true,"page.settings":true}'::jsonb
     WHERE name = 'designer'
       AND COALESCE((permissions ->> 'all')::boolean, false) = false;

    UPDATE role_definitions
       SET permissions = permissions || '{"page.design":true}'::jsonb
     WHERE name IN ('sales_rep', 'sales_marketing_manager')
       AND COALESCE((permissions ->> 'all')::boolean, false) = false;
  END IF;
END $$;
