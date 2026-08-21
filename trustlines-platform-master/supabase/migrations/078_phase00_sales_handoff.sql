-- 078_phase00_sales_handoff.sql — PHASE 00.5 Sales Handoff (2026-07-27)
--
-- Closes the last documented gap from 075/076: "Sales-side visibility (handoff/accept)
-- is NOT enabled yet... documented gap, next task." Adds the columns/RLS needed for the
-- real Sales handoff → accept → project creation flow (lib/marketing/salesHandoff.ts).
--
-- 🔴 THE RULE THIS MIGRATION PROTECTS (2026-07-22 architecture decision, still true):
-- a `projects` row, a reserved global project number, and Dropbox folders are created
-- ONLY at Sales `sales_accepted` — never at Marketing capture, qualification, or handoff
-- time. Nothing before this migration touches `projects`/`project_number_counter`/
-- Dropbox; nothing in this migration does either — only `lib/marketing/salesHandoff.ts`
-- (application code, reviewed separately) performs that side effect, using the exact
-- same `reserve_global_number()` RPC and `createProjectFolders()` helper the existing
-- `lead_intake` flow already uses — no second, divergent implementation.

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS scope_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS return_reason TEXT;

-- At most one Opportunity may point to a given Project (mirrors lead_intake.project_id's
-- own UNIQUE constraint — a Project is never shared between two handoff records).
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_project_unique
  ON opportunities (project_id) WHERE project_id IS NOT NULL;

-- ── ROW-LEVEL SECURITY — Sales read visibility (write stays route-gated, same pattern
-- as lead_intake: service-role admin client + requireRole()/ownership checks are the
-- real gate; RLS here is defense-in-depth for the rare direct-client read) ────────────
-- Sales sees an Opportunity once Marketing has moved it past internal qualification
-- (stage no longer 'new'/'marketing_qualification'/'on_hold') OR they're its accepted
-- owner — never before a real handoff, so Sales can't see Marketing's raw working pool.
DROP POLICY IF EXISTS opportunities_read_sales ON opportunities;
CREATE POLICY opportunities_read_sales ON opportunities
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('sales_rep', 'sales_marketing_manager'))
    AND (
      stage NOT IN ('new', 'marketing_qualification', 'on_hold')
      OR sales_owner_id = auth.uid()
    )
  );
