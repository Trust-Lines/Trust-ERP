-- 042_lead_tasks_completed_at.sql
-- When a subtask was finished, so the Tasks page can show/sort completion dates.
-- Set when status → 'done', cleared when it is re-opened.

ALTER TABLE lead_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lead_tasks_status ON lead_tasks(status);
