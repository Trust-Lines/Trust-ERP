-- 114_prospects_effective_created_at.sql — 2026-09-17
--
-- "Date Created" on the Contacts list must show and sort by the real ClickUp date when a
-- Contact came from ClickUp (external_created_at), falling back to our own created_at for
-- survey-native/manually-created Contacts that never had one. The UI already displayed that
-- COALESCE — the sort (app/api/marketing/prospects/route.ts) couldn't replicate it through
-- plain .order() on either column alone: sorting by created_at lost the real ClickUp dates,
-- sorting by external_created_at buried every NULL-dated Contact at the bottom regardless of
-- how recently it was actually added ("Cco, llc"/"Town mart" going missing under the Date
-- Created sort — found live). A real generated column lets both display and sort agree.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS effective_created_at TIMESTAMPTZ
  GENERATED ALWAYS AS (COALESCE(external_created_at, created_at)) STORED;

CREATE INDEX IF NOT EXISTS idx_prospects_effective_created_at ON prospects (effective_created_at DESC);
