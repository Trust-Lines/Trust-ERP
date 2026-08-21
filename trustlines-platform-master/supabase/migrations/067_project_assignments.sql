-- 067_project_assignments.sql — PHASE 11.3 Assignment Model
--
-- WHAT THIS SOLVES
--   Today assignment is FIXED COLUMNS on `projects` (tlines_pm_id, trustlines_pm_id, …).
--   That shape cannot express Phase 11's per-TYPE, multi-role assignment: every type
--   (Millwork / Shelving / Ceiling / Image / Furniture / Decoration) needs its own owner,
--   designer, shop drawer and supply responsible. Adding 4 columns × 6 types to `projects`
--   would be 24 columns and still not extensible → one junction table instead.
--
-- 🔴 WHAT THIS DELIBERATELY DOES **NOT** DO — duplicate protection at the MODEL level
--   The 11.0 audit found NO duplicate assignment structures, and that must stay true.
--   These slots ALREADY have a home and are NOT re-modelled here:
--     • production responsible → `production_items.assigned_to`   (live, board-integrated)
--     • T-Lines PM / Trust PM / ops / supervisor → `projects.*_id` fixed columns
--       (the PO signature chain + RLS read them — moving them would break signing)
--     • project-level QC → `projects.qc_inspector_id`
--     • Sales Design assignee → `sales_design_jobs.assigned_designer_id`
--   This table covers ONLY the slots with no home. "Project team" is DERIVED in
--   lib/assignments/team.ts from all of the above + this table — it is not stored twice.
--
-- TYPE IDENTITY: the `type` column holds a PROD_TYPES string ('Millwork', 'Shelving',
--   'Ceiling', 'Image', 'Furniture', 'Decoration') — exactly what production_items.type
--   holds (verified live: Millwork/Shelving/Image/Ceiling in use). `type IS NULL` means a
--   PROJECT-level assignment (e.g. the warehouse responsible for the whole project).
--
-- Role model: profiles.role is TEXT, no user_role enum. Nothing here touches roles.
-- Idempotent / re-runnable.

CREATE TABLE IF NOT EXISTS project_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- NULL = project-level; otherwise a PROD_TYPES value.
  type         TEXT,
  slot         TEXT NOT NULL,
  -- The assignee is ALWAYS a real person (Phase 11 §9: "Office string'i assignee olarak
  -- kullanılmaz"). ON DELETE SET NULL keeps the assignment row as an audit trail of the
  -- slot existing, rather than silently vanishing when someone leaves.
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT project_assignments_slot_check CHECK (slot IN (
    'type_owner',           -- owns the type end-to-end
    'type_designer',        -- designs it (a `designer` with the matching skill)
    'shop_drawer',          -- technical / shop drawings
    'supply_responsible',   -- supply development for the type
    'qc_responsible',       -- per-TYPE QC (projects.qc_inspector_id stays project-level)
    'warehouse_responsible' -- receiving / dispatch
  )),
  CONSTRAINT project_assignments_type_check CHECK (
    type IS NULL OR type IN ('Millwork','Shelving','Ceiling','Image','Furniture','Decoration')
  )
);

-- ── Duplicate protection (Phase 11.3: "Handoff audit + duplicate protection") ──
-- One person per slot per scope. Postgres treats NULLs as DISTINCT, so a plain
-- UNIQUE(project_id, type, slot) would NOT stop two project-level rows for the same slot.
-- Two partial indexes close that hole.
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_assignments_type_slot
  ON project_assignments(project_id, type, slot) WHERE type IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_assignments_project_slot
  ON project_assignments(project_id, slot) WHERE type IS NULL;

-- ── Indexes (AGENTS.md §5: Postgres does not auto-index FKs) ──
CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id);
-- "What is assigned to me?" — the My Day / workspace hot path.
CREATE INDEX IF NOT EXISTS idx_project_assignments_user    ON project_assignments(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_assignments_slot    ON project_assignments(slot);

-- updated_at trigger — reuses the existing helper (same pattern as 045/049).
DROP TRIGGER IF EXISTS trg_project_assignments_updated ON project_assignments;
CREATE TRIGGER trg_project_assignments_updated
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS (AGENTS.md §6: enable on every new user-facing table) ──
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- READ: every internal role + the PMs. Assignments are directory-style data — WHO does
-- what. They carry no PF / vendor price / margin, so tlines_pm may read them (they need
-- to know who to chase). Text-role model, same style as 045/049/050.
DROP POLICY IF EXISTS project_assignments_select ON project_assignments;
CREATE POLICY project_assignments_select ON project_assignments
  FOR SELECT USING (
    auth_role() IN (
      'ops_manager','general_manager','trustlines_pm','tlines_pm','project_manager',
      'pm_millwork','pm_ceiling','production_manager','production_user',
      'supply_manager','supply_user','design_lead','shop_drawer','designer',
      'qc_responsible','warehouse_manager','warehouse_user','logistics',
      'accounting','accountant','sales_rep','sales_marketing_manager'
    )
  );

-- WRITE: the people who actually hand work over. Sales/design/QC/warehouse line staff
-- and the customer-side PM do NOT assign work — they receive it. Fail closed.
DROP POLICY IF EXISTS project_assignments_write ON project_assignments;
CREATE POLICY project_assignments_write ON project_assignments
  FOR ALL USING (
    auth_role() IN (
      'ops_manager','general_manager','trustlines_pm','project_manager',
      'supply_manager','production_manager','design_lead','warehouse_manager'
    )
  ) WITH CHECK (
    auth_role() IN (
      'ops_manager','general_manager','trustlines_pm','project_manager',
      'supply_manager','production_manager','design_lead','warehouse_manager'
    )
  );

-- NOTE: the API routes use the service-role client (which BYPASSES RLS), so the real
-- enforcement is requireRole() in app/api/projects/[id]/assignments. These policies are
-- the second layer (AGENTS.md §3), not the only one.
