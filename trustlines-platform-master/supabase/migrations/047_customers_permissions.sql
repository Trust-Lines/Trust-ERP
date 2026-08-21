-- 047_customers_permissions.sql
-- Grant the Customers page/edit permission keys to the roles that own the End
-- Customer module. These roles have STORED permission maps (from 020/026), so the
-- catalog.ts DEFAULT_PERMISSIONS fallback does NOT apply to them — we must merge the
-- keys into role_definitions.permissions directly.
--
-- ops_manager / general_manager already hold {"all":true} (full authority) → skipped.
-- Merge is idempotent (jsonb `||`); safe to re-run.
--
--   • sales_rep, sales_marketing_manager : page.customers + edit.customers (Sales owns customers)
--   • tlines_pm, trustlines_pm           : page.customers only (read/view; Sales edits)

DO $$ BEGIN
  IF to_regclass('public.role_definitions') IS NOT NULL THEN
    UPDATE role_definitions
       SET permissions = permissions || '{"page.customers":true,"edit.customers":true}'::jsonb
     WHERE name IN ('sales_rep', 'sales_marketing_manager')
       AND COALESCE((permissions ->> 'all')::boolean, false) = false;

    UPDATE role_definitions
       SET permissions = permissions || '{"page.customers":true}'::jsonb
     WHERE name IN ('tlines_pm', 'trustlines_pm')
       AND COALESCE((permissions ->> 'all')::boolean, false) = false;
  END IF;
END $$;
