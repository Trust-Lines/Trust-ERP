-- 097_external_created_at.sql — 2026-08-13
--
-- User request: the Lead Cloud "Date created" column showed OUR row's created_at (the
-- moment WE imported it), not ClickUp's real task creation date — "date created
-- clickuptan gelsin buradan değil" (should come from ClickUp, not from here). ClickUp's
-- task.date_created was never captured at all until now.

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS external_created_at TIMESTAMPTZ;
