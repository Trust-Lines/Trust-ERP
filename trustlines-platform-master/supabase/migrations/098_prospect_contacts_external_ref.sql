-- 098_prospect_contacts_external_ref.sql — 2026-08-14
--
-- User caught two real import bugs live, comparing our Lead Cloud against real ClickUp
-- screenshots side by side:
--   1. entityType/personName were derived from whether "06-Company" was filled in — but
--      a real ClickUp Person often has their employer's name in that field too. Fixed in
--      lib/clickup/importMapping.ts using ClickUp's own explicit type marker instead
--      (custom_item_id 1001 = Person, 1010 = COMPANY).
--   2. A ClickUp COMPANY task can have multiple Person tasks nested under it as real
--      ClickUp SUBTASKS (e.g. "David Weisz" company with "Meg…"/"Zisha…" as its two
--      employee contacts) — the import treated every task as an independent top-level
--      Prospect, so a company's second (and third, ...) contact became its own separate,
--      wrong Prospect instead of an additional Contact on the real one ("sen bana 1'ini
--      almışsın"). This column lets the import dedupe a child subtask against the
--      prospect_contacts row it already created, the same way external_ref already does
--      for prospects/prospect_needs/opportunities.

ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS external_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_contacts_external_dedupe
  ON prospect_contacts (external_source, external_ref)
  WHERE external_source IS NOT NULL AND external_ref IS NOT NULL;
