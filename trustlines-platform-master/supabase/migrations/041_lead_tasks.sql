-- 041_lead_tasks.sql
-- ClickUp-style subtasks on a lead, each with its own assignee/status/due date.
-- The canonical one is "Collect Information": we often have only a name and a
-- sales rep must call the customer and gather the missing fields.
--
-- Same Sales-only RLS boundary as lead_intake (029): the owning rep + any
-- sales_marketing_manager. Access also goes through role-gated admin routes.

CREATE TABLE IF NOT EXISTS lead_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_intake_id UUID NOT NULL REFERENCES lead_intake(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'todo',
  assignee_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date       DATE,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_tasks_status_check CHECK (status IN ('todo','in_progress','done'))
);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead     ON lead_tasks(lead_intake_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_assignee ON lead_tasks(assignee_id) WHERE assignee_id IS NOT NULL;

ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;

-- (Dropped first so this migration is safe to re-run.)
DROP POLICY IF EXISTS lead_tasks_sales_rw ON lead_tasks;
CREATE POLICY lead_tasks_sales_rw ON lead_tasks
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM lead_intake li WHERE li.id = lead_intake_id
            AND (li.created_by = auth.uid()
                 OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM lead_intake li WHERE li.id = lead_intake_id
            AND (li.created_by = auth.uid()
                 OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')))
  );
