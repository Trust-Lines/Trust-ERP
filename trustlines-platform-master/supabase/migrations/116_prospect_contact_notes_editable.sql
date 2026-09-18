-- 116_prospect_contact_notes_editable.sql — 2026-09-18
--
-- prospect_contact_notes (092/095) could be posted and deleted, never edited — a typo or a
-- correction meant deleting the whole comment and re-posting it, losing the original
-- timestamp/thread position. Direct instruction: notes editable by their own author. Adds an
-- edited_at marker so the UI can show "(edited)" without losing the original created_at.

ALTER TABLE prospect_contact_notes ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
