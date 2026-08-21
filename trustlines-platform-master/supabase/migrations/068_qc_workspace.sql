-- 068_qc_workspace.sql — PHASE 11.4 (QC Workspace)
--
-- CONTEXT (audited, not assumed):
--   • `/qc` is IN the sidebar (perm page.qc) but the PAGE DOES NOT EXIST — a qc_responsible
--     user clicking QC gets a 404 today. Verified by driving the real app.
--   • `qc_checklists` was created in 001 and typed in types/database.ts, but has NO API and
--     NO UI, and holds 0 rows. It is the QC home in name only.
--   • `qc_result` IS a REAL enum in the live DB — ('pass','fail','pending'), verified by a
--     probe (invalid value → 22P02). This is UNLIKE `user_role`, which 001 declares but the
--     live DB does not have. So the CLAUDE.md "no enum" rule is specific to user_role.
--     `overall_result` already covers pass/fail/pending — this migration does NOT touch it.
--
-- WHAT THIS ADDS: the two links QC was missing, and nothing else.
--   • production_item_id → per-TYPE QC. Phase 11 wants QC per type (Millwork, Ceiling …);
--     qc_checklists was only ever linked to a PROJECT + document.
--   • rework_of_id → the fail → rework → re-inspection loop, as a self-reference.
--
-- 🔴 NO STATUS COLUMN, DELIBERATELY. "Ready for QC" / "My inspections" / "Failed" /
--    "Rework" / "Completed" are all DERIVED (lib/qc/queue.ts) from overall_result +
--    production_items.status + rework_of_id. A stored status would be a second home for
--    facts those already answer, and would drift the moment someone moved an item on the
--    board. Same rule as Phase 11.3's assignments and Phase 10's My Day.
--
-- ADDITIVE / idempotent / re-runnable. Nothing renamed or dropped.

-- ── 1. Columns ───────────────────────────────────────────────────────────────────
-- The type link. CASCADE: an inspection of a deleted production item is meaningless.
ALTER TABLE qc_checklists ADD COLUMN IF NOT EXISTS production_item_id UUID
  REFERENCES production_items(id) ON DELETE CASCADE;

-- The rework chain. SET NULL, not CASCADE: if the failed original is ever removed the
-- re-inspection is still a real inspection that happened — losing it would rewrite history.
ALTER TABLE qc_checklists ADD COLUMN IF NOT EXISTS rework_of_id UUID
  REFERENCES qc_checklists(id) ON DELETE SET NULL;

-- "Checklist + photo evidence" (Phase 11 §4). Dropbox holds files; this holds the
-- lightweight refs/urls the inspector attaches. Kept small — never base64 blobs.
ALTER TABLE qc_checklists ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE qc_checklists ADD COLUMN IF NOT EXISTS notes  TEXT;
-- Soft delete, consistent with projects/documents/production_items.
ALTER TABLE qc_checklists ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- An inspection cannot be its own rework (an easy API slip that would loop the chain).
ALTER TABLE qc_checklists DROP CONSTRAINT IF EXISTS qc_rework_not_self_check;
ALTER TABLE qc_checklists ADD  CONSTRAINT qc_rework_not_self_check
  CHECK (rework_of_id IS NULL OR rework_of_id <> id);

-- ── 2. Duplicate protection ──────────────────────────────────────────────────────
-- At most ONE OPEN (pending) inspection per production item. Without this, two QC users
-- opening the queue at the same time both create one and the item is inspected twice.
-- Partial + WHERE pending, so the history of past pass/fail rows is unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_open_per_item
  ON qc_checklists(production_item_id)
  WHERE production_item_id IS NOT NULL AND overall_result = 'pending' AND deleted_at IS NULL;

-- ── 3. Indexes (AGENTS.md §5 — Postgres does not auto-index FKs) ────────────────
CREATE INDEX IF NOT EXISTS idx_qc_item      ON qc_checklists(production_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qc_project   ON qc_checklists(project_id)         WHERE deleted_at IS NULL;
-- "My inspections" — the workspace's hot path.
CREATE INDEX IF NOT EXISTS idx_qc_conductor ON qc_checklists(conducted_by)       WHERE conducted_by IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qc_result    ON qc_checklists(overall_result)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qc_rework    ON qc_checklists(rework_of_id)       WHERE rework_of_id IS NOT NULL;

-- ── 4. RLS ───────────────────────────────────────────────────────────────────────
-- RLS is already ENABLED on qc_checklists (002) with:
--     "internal_qc" FOR ALL USING (is_internal_role())
-- is_internal_role() (as rewritten by 046) covers ops_manager, general_manager, pm_millwork,
-- pm_ceiling, trustlines_pm, qc_responsible, logistics, accounting — but NOT the roles 11.1
-- added. `production_manager` in particular CAN hold the per-type qc_responsible slot (11.3)
-- yet could not read a single checklist through RLS.
--
-- is_internal_role() is deliberately NOT widened here: it gates several other tables with
-- FOR ALL (writes included), so adding roles there would silently grant write access to
-- stage_transitions / project_notes as a side effect. Instead this adds a policy scoped to
-- QC only. Permissive policies OR together, so this widens qc_checklists and nothing else.
DROP POLICY IF EXISTS qc_phase11_read ON qc_checklists;
CREATE POLICY qc_phase11_read ON qc_checklists
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'production_manager','production_user','project_manager',
      'supply_manager','supply_user','warehouse_manager','warehouse_user'
    )
  );

-- Write stays narrow: only the people who actually inspect or run production.
DROP POLICY IF EXISTS qc_phase11_write ON qc_checklists;
CREATE POLICY qc_phase11_write ON qc_checklists
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('production_manager','project_manager')
  ) WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('production_manager','project_manager')
  );

-- NOTE: the API routes use the service-role client (RLS bypassed), so requireRole() in
-- app/api/qc/** is the real enforcement (AGENTS.md §3). These policies are layer two.
