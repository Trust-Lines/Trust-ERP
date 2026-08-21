-- 091_potentials_clickup_import.sql — 2026-08-13
--
-- Third piece of the ClickUp import: the 23 Potential/In Target List rows (already
-- imported by scripts/clickup-import-opportunities.mts as prospect_potentials rows)
-- need the same external_source/external_ref/external_stage_label traceability as
-- `opportunities` got in migration 090, so the /leads unified board can split them into
-- their own real "Potential" vs "In Target List" buckets instead of hiding them on a
-- separate page only (user: "burda da olacak, ayrı sayfa olabilir ama burda da olcak").

ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS external_source      TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS external_ref         TEXT;
ALTER TABLE prospect_potentials ADD COLUMN IF NOT EXISTS external_stage_label TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_potentials_external_ref
  ON prospect_potentials (external_source, external_ref) WHERE external_source IS NOT NULL AND external_ref IS NOT NULL;
