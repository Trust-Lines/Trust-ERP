-- 080_production_items_rls_hardening.sql — close a real, measured RLS gap.
--
-- `production_items_select` (migration 014) was `FOR SELECT TO authenticated USING
-- (true)` — ANY authenticated user, any role, could SELECT * and read pf_usd/pf_tl/
-- expenses_usd/expenses_tl (PF cost, vendor invoice, margin-adjacent fields) directly
-- via the Supabase REST API, completely bypassing every application-layer permission
-- check (requirePage('page.production'), column allowlists, etc — all of which use the
-- service-role admin client and never touch RLS in the first place).
--
-- Live-measured (2026-08-06): signed in as the real `tlines_pm` profile and queried
-- `production_items` directly with no service role — the query succeeded and returned
-- pf_usd/pf_tl/expenses_usd/expenses_tl. CLAUDE.md's immutable rule ("tlines_pm PF,
-- vendor alış fiyatı, iç maliyet veya margin göremez") was resting on an application-
-- layer assumption only, not enforced at the data layer, exactly as flagged in
-- PROJECT-MASTER-PLAN.md's unchecked "11.1 follow-up: verify with a REAL tlines_pm
-- session that PF is unreachable" item.
--
-- `tlines_pm` is the ONLY client-facing (non-internal) role in the system (see
-- Sidebar.tsx's `isInternal = userRole !== 'tlines_pm'`) — every other role is Trust-
-- Lines-internal and legitimately needs to read production_items (Supply/Production/
-- QC/Logistics/PM workspaces all depend on it). No application flow uses the RLS-
-- enforced browser client for this table (grepped: every reader is a server component
-- or API route on the service-role admin client), so tightening this policy changes
-- NOTHING about how the app behaves — it only closes the direct-API bypass.

DROP POLICY IF EXISTS production_items_select ON production_items;
CREATE POLICY production_items_select ON production_items
  FOR SELECT TO authenticated USING (
    NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'tlines_pm')
  );
