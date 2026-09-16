-- 110_campaign_survey_template_quick.sql — 2026-09-17
--
-- Adds the new "Quick Survey" (T Lines short-form — components/platform/survey/
-- QuickSurvey.tsx) to the set of survey templates a campaign's `survey_template` column
-- may hold. Widens migration 107's CHECK constraint from
-- ('none', 'soccer_challenge', 'general') to include 'quick'.

ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_survey_template_check;
ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_survey_template_check
  CHECK (survey_template IN ('none', 'soccer_challenge', 'general', 'quick'));
