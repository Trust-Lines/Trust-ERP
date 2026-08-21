-- 032_lead_intake_customer_fields.sql
-- The intake form is now the ENTRY POINT for a new customer/lead (created from the
-- "New Form" page), not a form opened from a pre-existing mock lead. So the intake
-- row must carry the real end-customer details (this is the T-Lines/customer side —
-- there is no internal "client" pick here) and drive the Leads board.
--
-- Adds:
--   • real customer/contact fields,
--   • split address parts (project name = "{no} - {city} - {street} - {state}"),
--   • opportunity_status so the existing Leads board can group real rows.

ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS customer_name   TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS brand           TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS customer_email  TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS contact_person  TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS contact_phone   TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS industry        TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS city            TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS street          TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS state           TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS opportunity_status TEXT NOT NULL DEFAULT 'new_opportunity';

ALTER TABLE lead_intake DROP CONSTRAINT IF EXISTS lead_intake_opp_status_check;
ALTER TABLE lead_intake ADD CONSTRAINT lead_intake_opp_status_check
  CHECK (opportunity_status IN ('new_opportunity','ready_to_start','modification_request','waiting_from_op'));

-- client_id is no longer required (kept for optional linkage). No change needed —
-- it was already nullable in migration 029.
