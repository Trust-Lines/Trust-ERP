-- 107_campaign_survey_template_general.sql — 2026-08-28
--
-- Adds the new default, always-on "General Survey" (T Lines Store Passport —
-- components/platform/survey/GeneralSurvey.tsx) to the set of survey templates a
-- campaign's `survey_template` column may hold. Widens migration 102's CHECK
-- constraint from ('none', 'soccer_challenge') to include 'general'.

ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_survey_template_check;
ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_survey_template_check
  CHECK (survey_template IN ('none', 'soccer_challenge', 'general'));
