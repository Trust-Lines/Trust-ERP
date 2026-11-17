-- 153_trust_lines_tasks.sql
-- Dashboard card popup → "Trust Lines Tasks": Trust Lines' own to-dos for a project, next to the
-- T Lines tasks (lead_tasks, which live on the deal). A task hangs on the card's project number
-- ("no-507"), so every card of that project shows the same list; a card without a number uses
-- its own kind + id ("opportunity-<uuid>"). Assigning someone sends them a notification.
-- Access goes through /api/tlines-dashboard/trust-tasks (requireTlinesDashboard: read = dashboard
-- viewers, write = dashboard managers). RLS below only lets a signed-in user read the tasks
-- assigned to or created by them; the service-role routes do the rest.

CREATE TABLE IF NOT EXISTS trust_lines_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor       TEXT NOT NULL,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'todo',
  assignee_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date     DATE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT trust_lines_tasks_status_check CHECK (status IN ('todo','in_progress','done')),
  CONSTRAINT trust_lines_tasks_anchor_check CHECK (anchor ~ '^(no|opportunity|potential|project|trust)-[A-Za-z0-9-]{1,64}$'),
  CONSTRAINT trust_lines_tasks_title_check CHECK (char_length(title) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_trust_lines_tasks_anchor   ON trust_lines_tasks(anchor, created_at);
CREATE INDEX IF NOT EXISTS idx_trust_lines_tasks_assignee ON trust_lines_tasks(assignee_id) WHERE assignee_id IS NOT NULL;

ALTER TABLE trust_lines_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trust_lines_tasks_own_read ON trust_lines_tasks;
CREATE POLICY trust_lines_tasks_own_read ON trust_lines_tasks
  FOR SELECT
  USING (assignee_id = auth.uid() OR created_by = auth.uid());
