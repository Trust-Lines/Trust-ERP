-- 087_marketing_campaigns_state.sql — 2026-08-11
--
-- User correction after the first live create attempt: "our fairs are always in the
-- USA" — the Create Campaign form is being simplified to a State (US) dropdown + a city
-- autocomplete (same LocationSearch/US_STATES pattern as NewProjectForm.tsx), not free
-- text city/country entry. `marketing_campaigns` had `city`/`country` (086) but no
-- `state` column to hold the picked state abbreviation — additive fix.

ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS state TEXT;

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_state ON marketing_campaigns (state) WHERE state IS NOT NULL;
