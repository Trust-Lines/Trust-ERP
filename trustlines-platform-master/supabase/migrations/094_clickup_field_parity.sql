-- 094_clickup_field_parity.sql — 2026-08-13
--
-- User compared our Prospect 360 screen directly against a live ClickUp Person task and
-- asked for it to be field-complete: every "Fields from this List" row ClickUp shows
-- (01-State ... x-Note) must exist somewhere on our side too, not just the subset the
-- original Contacts import (088) captured. Four raw fields were never captured at all:
-- Company 2 Phone Number, PROJECT #, Project info, x-Note. A fifth — "13-SOURCE" — WAS
-- captured but only as our own classified LeadSource enum (prospects.source_label,
-- e.g. 'referral'), losing ClickUp's exact original wording (e.g. "REFERAL"); added back
-- verbatim as source_raw_label so the screen can show the same text ClickUp shows.

ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS company2_phone TEXT;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_raw_label TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS external_project_code TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS project_info TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS x_note TEXT;
