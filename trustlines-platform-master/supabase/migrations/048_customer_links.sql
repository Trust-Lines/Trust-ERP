-- 048_customer_links.sql
-- Phase 1 — connect the End Customer (migration 045) to the two things that need it:
--   • lead_intake.customer_id  — a lead can be linked to a structured customer.
--   • projects.customer_id     — the delivered project carries the customer, which
--                                powers the Customer 360 "project history".
--
-- Both are ADDITIVE, nullable FKs (ON DELETE SET NULL) — nothing existing changes,
-- and clients/client_companies are untouched (Phase 0 decision). Postgres does not
-- auto-index FKs, so an index is added for each (AGENTS §5).

ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lead_intake_customer ON lead_intake(customer_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);
