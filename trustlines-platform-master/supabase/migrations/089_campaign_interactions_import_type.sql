-- 089_campaign_interactions_import_type.sql — 2026-08-11
--
-- The ClickUp Contacts bulk import (scripts/clickup-import-write.mts, see
-- docs/CLICKUP_IMPORT.md) records each contact's real trade-fair attendance history as
-- campaign_interactions rows. Migration 086 only allowed `interaction_type =
-- 'survey_submission'` (the only kind that existed at the time — a public form submit).
-- A bulk-imported historical attendance is NOT a survey submission (no
-- survey_submissions row backs it — nobody filled out our public form for these), so
-- labeling it 'survey_submission' would be dishonest. Additive widen, not a rename.

ALTER TABLE campaign_interactions DROP CONSTRAINT IF EXISTS campaign_interactions_type_check;
ALTER TABLE campaign_interactions ADD  CONSTRAINT campaign_interactions_type_check
  CHECK (interaction_type IN ('survey_submission', 'clickup_import'));
