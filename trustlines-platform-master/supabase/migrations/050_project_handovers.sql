-- 050_project_handovers.sql
-- Phase 1/3 bridge — Closed Won → Project Handover. One handover record per project:
-- a tracked checklist (JSONB) the PM works through when Sales hands a project to
-- Trust-Lines, plus a handover meeting time and completion stamp.
--
-- Additive; RLS ENABLED (TEXT role model). The mechanical handover already happens in
-- /api/leads/[id]/deliver; this table just makes the human checklist explicit.

CREATE TABLE IF NOT EXISTS project_handovers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  checklist      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{key,label,done,done_at,done_by}]
  status         TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | complete
  meeting_at     TIMESTAMPTZ,
  notes          TEXT,
  handed_over_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  handover_at    TIMESTAMPTZ,                          -- set when status → complete
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_handovers_project ON project_handovers(project_id);

DROP TRIGGER IF EXISTS trg_project_handovers_updated_at ON project_handovers;
CREATE TRIGGER trg_project_handovers_updated_at
  BEFORE UPDATE ON project_handovers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_handovers ENABLE ROW LEVEL SECURITY;

-- Read for internal + PM roles; write for ops/gm + both PMs (they run the handover).
DROP POLICY IF EXISTS project_handovers_read ON project_handovers;
CREATE POLICY project_handovers_read ON project_handovers
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm',
                           'pm_millwork','pm_ceiling','sales_rep','sales_marketing_manager'))
  );

DROP POLICY IF EXISTS project_handovers_write ON project_handovers;
CREATE POLICY project_handovers_write ON project_handovers
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  );
