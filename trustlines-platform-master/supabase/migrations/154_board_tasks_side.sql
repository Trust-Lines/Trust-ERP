-- 154_board_tasks_side.sql
-- The dashboard card popup has two task lists: "T Lines Tasks" and "Trust Lines Tasks" — the
-- to-dos agreed when a project is discussed in a meeting. Both now live in trust_lines_tasks
-- (migration 153), told apart by `side`. T Lines tasks no longer come from the deal's sales tasks
-- (lead_tasks), which stay where they are for Sales / Marketing.
-- Apply after 153.

ALTER TABLE trust_lines_tasks ADD COLUMN IF NOT EXISTS side TEXT NOT NULL DEFAULT 'trust';

ALTER TABLE trust_lines_tasks DROP CONSTRAINT IF EXISTS trust_lines_tasks_side_check;
ALTER TABLE trust_lines_tasks ADD CONSTRAINT trust_lines_tasks_side_check CHECK (side IN ('trust', 'tlines'));

DROP INDEX IF EXISTS idx_trust_lines_tasks_anchor;
CREATE INDEX IF NOT EXISTS idx_trust_lines_tasks_anchor_side ON trust_lines_tasks(anchor, side, created_at);
