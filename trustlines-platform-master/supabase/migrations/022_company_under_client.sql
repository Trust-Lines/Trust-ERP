-- 022_company_under_client.sql
-- Flatten the client hierarchy: services (client_companies like "Store Maker")
-- now hang directly under a client, not a franchise. Add a direct client link.
-- (franchise_id stays for legacy rows; new services use client_id.)

ALTER TABLE client_companies
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Services no longer require a franchise, so franchise_id must be nullable.
ALTER TABLE client_companies
  ALTER COLUMN franchise_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_companies_client ON client_companies(client_id);
