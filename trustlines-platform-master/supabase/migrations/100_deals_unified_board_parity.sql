-- 100_deals_unified_board_parity.sql — 2026-08-14
--
-- User compared the Opportunities/Potentials pages against the REAL ClickUp
-- "Opportunities NE" list side by side and asked for exact column parity — including
-- three custom fields never captured before (Deal Size → estimated_value was already a
-- column but never populated by the import; Deposit; Payment; Targeted) plus ClickUp's
-- native task Due date / Date done. Opportunities already has `deadline` (Due date) and
-- `closed_at` (Date done) doing that job — only the net-new ones go on `opportunities`.
-- `prospect_potentials` has none of this yet (it was built as a lightweight "future
-- possibility" tracker, not a ClickUp-parity one) — brought up to the same shape so the
-- two tables can be merged into ONE board matching ClickUp's single list exactly.

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS deposit NUMERIC;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS payment_raw TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS targeted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS primary_contact_id UUID REFERENCES prospect_contacts(id) ON DELETE SET NULL;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS date_done TIMESTAMPTZ;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS deposit NUMERIC;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS payment_raw TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS targeted BOOLEAN NOT NULL DEFAULT false;
