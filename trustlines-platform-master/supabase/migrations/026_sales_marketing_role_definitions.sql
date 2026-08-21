-- 026_sales_marketing_role_definitions.sql
-- Seed the two Sales & Marketing roles into role_definitions so they show up as
-- assignable roles in the Team UI. Follows the seed pattern of migrations 016/020
-- (guarded INSERT ... SELECT FROM VALUES ... WHERE NOT EXISTS; safe to re-run).
--
-- Permissions are intentionally MINIMAL for now — only `page.dashboard`, so a
-- member can log in and land on the dashboard. The detailed Sales permission keys
-- (page.sales_*, edit.sales_*, view.sales_*) are added in the NEXT step, NOT here.
--
-- SECURITY BOUNDARY: see 025. These roles must NOT receive any view.* / edit.*
-- keys that would expose production / finance / PM data (PF, margins, supplier
-- prices, production board, approvals). Keep the permission map minimal here.

DO $$ BEGIN
  IF to_regclass('public.role_definitions') IS NOT NULL THEN
    INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
    SELECT v.name, v.label, v.description, v.bg, v.fg, true, v.perms::jsonb
    FROM (VALUES
      ('sales_marketing_manager',
       'Sales & Marketing Manager',
       'Sales & Marketing team lead — oversees opportunities across all regions (Sales module only; no access to production, finance, PF or PM data).',
       '#fde68a', '#92400e',
       '{"page.dashboard":true}'),
      ('sales_rep',
       'Sales Representative',
       'Regional sales rep — sees only opportunities assigned to their region (Sales module only; no access to production, finance, PF or PM data).',
       '#fed7aa', '#9a3412',
       '{"page.dashboard":true}')
    ) AS v(name, label, description, bg, fg, perms)
    WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = v.name);
  END IF;
END $$;
