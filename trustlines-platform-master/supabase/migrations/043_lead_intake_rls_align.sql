-- 043_lead_intake_rls_align.sql
-- Align the lead_intake RLS policy with what the API actually enforces
-- (lib/sales/leadAccess.ts). Migration 029's policy only allowed `created_by` or a
-- sales_marketing_manager, so RLS was STRICTER than the app: a rep could open a
-- lead assigned to them, or one they hold a subtask on, only because the API routes
-- use the service-role client (which bypasses RLS).
--
-- RLS is defense-in-depth here, but the two rules diverging is a trap for whoever
-- next writes a query with the RLS-scoped client. Same three conditions as the API:
--   1. created_by = me, 2. assignee_id = me, 3. I have a subtask assigned on it.

DROP POLICY IF EXISTS lead_intake_sales_rw ON lead_intake;
CREATE POLICY lead_intake_sales_rw ON lead_intake
  FOR ALL
  USING (
    created_by = auth.uid()
    OR assignee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM lead_tasks t
               WHERE t.lead_intake_id = lead_intake.id AND t.assignee_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR assignee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM lead_tasks t
               WHERE t.lead_intake_id = lead_intake.id AND t.assignee_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
  );
