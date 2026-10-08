-- 124_prospect_created_by_label.sql — 2026-10-08
--
-- NACS 26 survey: the booth staff pick "who is entering this" (Layal, Justin, T, Naim, Merve,
-- Hashem) on the second screen, and it must show as a "Created by" cell on the Contact's profile.
-- `prospects.created_by` (a profile id) cannot hold it: survey Prospects are attributed to the
-- campaign owner, and the representatives are not all ERP users. So: a plain text label.
--
-- Additive only. The application writes/reads this column defensively, so deploying code before
-- this migration is applied is safe — "Created by" simply stays empty until it is.

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS created_by_label TEXT;
