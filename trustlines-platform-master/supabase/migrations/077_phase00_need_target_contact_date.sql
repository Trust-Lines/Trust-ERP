-- 077_phase00_need_target_contact_date.sql — PHASE 00.3c compatibility correction
--
-- Audit finding: 076's `prospect_needs` table was missing `target_contact_date`, a field
-- explicitly required by the Phase 00.3c spec (mirrors the field that existed on
-- `prospects` since migration 073, and on `prospect_potentials` since 076). Without it,
-- "Contact later" timing at the Need level had nowhere to store the user's chosen date —
-- the wizard was already sending it (LeadCaptureWizard.tsx's `need.target_contact_date`)
-- but the API silently dropped it since the column didn't exist. This migration is
-- purely additive; no existing data is touched or removed.

ALTER TABLE prospect_needs ADD COLUMN IF NOT EXISTS target_contact_date DATE;

-- Mirrors the same rule that existed at the Prospect level (073) and still exists on
-- prospect_potentials (076): "contact later" is meaningless without a date.
ALTER TABLE prospect_needs DROP CONSTRAINT IF EXISTS prospect_needs_target_contact_date_check;
ALTER TABLE prospect_needs ADD  CONSTRAINT prospect_needs_target_contact_date_check
  CHECK (timing IS DISTINCT FROM 'contact_later' OR target_contact_date IS NOT NULL);

-- Backfill: needs created by 076's backfill (from a Prospect's legacy 073
-- target_contact_date column) should carry that date forward too, for the Needs whose
-- timing is 'contact_later' and don't already have one (a Need created by real 00.3c
-- traffic after 076 landed always has this field intact and is left alone).
UPDATE prospect_needs n
SET target_contact_date = p.target_contact_date
FROM prospects p
WHERE n.prospect_id = p.id
  AND n.timing = 'contact_later'
  AND n.target_contact_date IS NULL
  AND p.target_contact_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_needs_target_contact_date
  ON prospect_needs (target_contact_date) WHERE target_contact_date IS NOT NULL;
