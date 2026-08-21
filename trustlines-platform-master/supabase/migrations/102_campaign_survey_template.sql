-- 102_campaign_survey_template.sql — 2026-08-17
--
-- Lets a Marketing user pick which public survey UI a campaign's `/survey/{slug}` link
-- renders, from the "New Campaign" form itself. Only one real template exists today
-- (`soccer_challenge`, the gamified NACS 26 form — components/platform/survey/
-- SoccerChallenge.tsx); `none` is the default for every campaign created before this
-- migration (and for any future campaign with no page built yet) — the public page shows
-- a plain "not ready yet" message rather than guessing or crashing.

ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS survey_template TEXT NOT NULL DEFAULT 'none';

ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_survey_template_check;
ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_survey_template_check
  CHECK (survey_template IN ('none', 'soccer_challenge'));
