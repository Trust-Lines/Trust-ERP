-- 040_lead_intake_soft_delete.sql
-- Archive + 30-day trash for leads (mirrors the projects soft-delete, migration 009).
--   is_archived  — hidden from the active board, reversible, NOT trash.
--   deleted_at   — moved to trash; restorable; purge after 30 days.

ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lead_intake_deleted  ON lead_intake(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_intake_archived ON lead_intake(is_archived) WHERE is_archived = true;
