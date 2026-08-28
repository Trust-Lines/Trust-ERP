-- 106_fix_lead_tasks_rls_recursion.sql — fixes a real, live "infinite recursion detected in
-- policy for relation lead_tasks" error (42P17), reported by the user running the app directly
-- (not caught earlier this session because every prior test used the service-role admin client,
-- which bypasses RLS entirely and never exercises this path).
--
-- Root cause — a genuine circular RLS reference between two tables' policies:
--   • lead_intake_sales_rw (migration 043) checks lead_tasks:
--       EXISTS (SELECT 1 FROM lead_tasks t WHERE t.lead_intake_id = lead_intake.id AND t.assignee_id = auth.uid())
--   • lead_tasks_sales_rw (migrations 081/101) checks lead_intake:
--       EXISTS (SELECT 1 FROM lead_intake li WHERE li.id = lead_intake_id AND ...)
-- Evaluating either table's RLS requires evaluating the other's, which requires the first's again
-- — Postgres detects this cycle at query-rewrite time and refuses, for EVERY query against either
-- table run through an RLS-enforced (non-admin) client, regardless of row count.
--
-- Fix: break the cycle with a SECURITY DEFINER helper. A SECURITY DEFINER function owned by the
-- migration-running role reads lead_tasks WITHOUT re-triggering lead_tasks' own RLS policy (RLS
-- only applies to the querying session's role for a table it queries directly through PostgREST/
-- the session role — a SECURITY DEFINER function's internal query runs as the function owner,
-- which is not subject to RLS unless that table has FORCE ROW LEVEL SECURITY, which none of these
-- do). This is the same "helper function to short-circuit a cross-table RLS check" pattern
-- CLAUDE.md/AGENTS.md's `auth_role()` (migration 002) already established for is_internal_role().

CREATE OR REPLACE FUNCTION has_lead_task_assigned_to_me(p_lead_intake_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lead_tasks t
    WHERE t.lead_intake_id = p_lead_intake_id AND t.assignee_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION has_lead_task_assigned_to_me FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_lead_task_assigned_to_me TO authenticated, service_role;

DROP POLICY IF EXISTS lead_intake_sales_rw ON lead_intake;
CREATE POLICY lead_intake_sales_rw ON lead_intake
  FOR ALL
  USING (
    created_by = auth.uid()
    OR assignee_id = auth.uid()
    OR has_lead_task_assigned_to_me(lead_intake.id)
    OR EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR assignee_id = auth.uid()
    OR has_lead_task_assigned_to_me(lead_intake.id)
    OR EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
  );

-- lead_tasks' own policy is UNCHANGED — it still checks lead_intake directly. That direction is
-- now safe: lead_intake's policy no longer queries lead_tasks directly (it goes through the
-- SECURITY DEFINER function instead), so there is no cycle left to detect.
