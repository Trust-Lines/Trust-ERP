-- 096_prospect_tags.sql — 2026-08-13
--
-- User request: Lead Cloud should visually mirror ClickUp's own List view exactly —
-- name prefixed with a Person/Organization icon, and the colored Tags ClickUp shows
-- next to each name (e.g. "jewelry store", "luxury store", "architect", "networking").
-- These are ClickUp's native task Tags (task.tags: [{name, tag_bg, ...}]), a different
-- concept from the "13-BUSNIESS TYPE" custom field already imported — stored as JSONB to
-- keep each tag's real ClickUp color, not just its name.

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
