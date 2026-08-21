-- 033_lead_intake_customer_address.sql
-- The customer's OWN address (billing/company address), separate from the project
-- SITE address (city/street/state). The project name is built ONLY from the site
-- address — this field is informational and never feeds the name.

ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS customer_address TEXT;
