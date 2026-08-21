-- 088_clickup_import_fields.sql — 2026-08-11
--
-- Additive fields needed to import the user's real ClickUp "Contacts" workspaces
-- (T LINES North East / South East / NATION WIDE / CVWTLINES W — read-only discovery
-- via lib/clickup/client.ts + scripts/clickup-discover.mts; see docs/CLICKUP_IMPORT.md).
-- Nothing existing is renamed, retyped, or dropped. `prospects.industry` already exists
-- (free-text single value, used by the Lead Capture wizard) and is left untouched —
-- ClickUp's "08-BUSNIESS TYPE" is a MULTI-select, so it gets its own new column rather
-- than forcing a type change onto a column other code already depends on.

-- ── Import traceability — the real dedupe key for this bulk import (far more reliable
-- than fuzzy email/phone matching at this volume: ~2,000 ClickUp Contact tasks). Lets
-- the import script run again safely (update-in-place) instead of ever double-creating.
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS external_ref    TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_external_ref
  ON prospects (external_source, external_ref) WHERE external_source IS NOT NULL AND external_ref IS NOT NULL;

-- ── Region tag at the Prospect level — the user's ClickUp data is organized per T-Lines
-- region (NE/SE/NW/CVW) from the moment a Contact is captured, before any project Need
-- exists. prospect_needs already got region/service_line/state in migration 085 (for
-- project creation); this is the same REGION_CODES vocabulary (lib/regions.ts), one
-- level up, so Lead Cloud can filter/group by region without requiring a Need first.
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS region TEXT;
CREATE INDEX IF NOT EXISTS idx_prospects_region ON prospects (region) WHERE region IS NOT NULL;

-- ── Real ClickUp fields with no existing home ────────────────────────────────────
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS business_types TEXT[] NOT NULL DEFAULT '{}';  -- "08-BUSNIESS TYPE" (multi-select)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_detail  TEXT;                            -- "14-Source info" (free text elaborating source_label)

ALTER TABLE prospect_locations ADD COLUMN IF NOT EXISTS latitude        NUMERIC;   -- "11-Location" geocode
ALTER TABLE prospect_locations ADD COLUMN IF NOT EXISTS longitude       NUMERIC;
ALTER TABLE prospect_locations ADD COLUMN IF NOT EXISTS mailing_address TEXT;      -- "12-Mailing address" — distinct from the site/11-Location address

ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS other_contact TEXT;      -- "07-Other contact" (alternate phone/way to reach them)
ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS whatsapp      BOOLEAN NOT NULL DEFAULT FALSE;  -- "WhatsApp" checkbox

CREATE INDEX IF NOT EXISTS idx_prospects_business_types ON prospects USING GIN (business_types);
