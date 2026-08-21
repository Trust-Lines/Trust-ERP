-- ─────────────────────────────────────────────────────────────
-- Migration 005: Project Steps (Real Workflow)
-- New workflow: Phase1 → Phase2 → Phase3(per-category) → Delivery
-- ─────────────────────────────────────────────────────────────

-- Add new document types
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'proposal';
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'plan_layout';
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'construction_drawings';

-- Add step context columns to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS step_key  TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cat_group TEXT;

-- ── PROJECT STEPS TABLE ───────────────────────────────────────
-- Stores the completion status of each workflow step per project.
-- Rows are created on-demand when a step is first acted upon.
CREATE TABLE IF NOT EXISTS project_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase        TEXT NOT NULL,    -- 'phase1' | 'phase2' | 'phase3' | 'delivery'
  cat_group    TEXT,             -- 'millwork' | 'shelving' | 'ceiling' | 'image' | NULL
  step_key     TEXT NOT NULL,    -- 'closed_deal' | 'proposal' | 'item_plan' | etc.
  status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'done'|'approved'|'rejected'
  document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  version_approved INTEGER,      -- which version was approved (for client_approval etc.)
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  approved_by  UUID REFERENCES profiles(id),
  approved_at  TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_steps_project ON project_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_lookup  ON project_steps(project_id, phase, cat_group, step_key);

CREATE TRIGGER trg_project_steps_updated_at
  BEFORE UPDATE ON project_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE project_steps ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user with a profile
CREATE POLICY "steps_select"
  ON project_steps FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );

-- INSERT: requires WITH CHECK (not USING) for inserts
CREATE POLICY "steps_insert"
  ON project_steps FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );

-- UPDATE: both USING and WITH CHECK required
CREATE POLICY "steps_update"
  ON project_steps FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );
