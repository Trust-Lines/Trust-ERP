-- 082_opportunities_priority.sql — Opportunities command-center (Faz 2, 2026-08-07).
-- ClickUp's "Opportunities NE" board has a Priority column with no equivalent on
-- `opportunities` (lead_intake already has this exact pattern — mirrored here).

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_priority_check;
ALTER TABLE opportunities ADD  CONSTRAINT opportunities_priority_check
  CHECK (priority IN ('low', 'medium', 'high'));
