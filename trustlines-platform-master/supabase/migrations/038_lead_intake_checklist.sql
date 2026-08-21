-- 038_lead_intake_checklist.sql
-- ClickUp-style checklist / subtasks on a lead. Array of {id, text, done} kept in
-- one JSONB column (small, per-lead) — no separate table needed.

ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb;
