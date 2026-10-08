-- 125_campaign_interaction_excel_import.sql — 2026-10-08
--
-- "Import Excel" (Marketing → Import) links every imported Contact to its campaign so the show
-- appears under "Shows attended". campaign_interactions.interaction_type is limited by a CHECK
-- (086: 'survey_submission', widened by 089: + 'clickup_import'); add 'excel_import' while KEEPING
-- every value already allowed/in use. Additive and safe: the application records the interaction
-- tolerantly, so importing works (without the "Shows attended" line) until this is applied.

ALTER TABLE campaign_interactions DROP CONSTRAINT IF EXISTS campaign_interactions_type_check;
ALTER TABLE campaign_interactions ADD  CONSTRAINT campaign_interactions_type_check
  CHECK (interaction_type IN ('survey_submission', 'clickup_import', 'excel_import'));
