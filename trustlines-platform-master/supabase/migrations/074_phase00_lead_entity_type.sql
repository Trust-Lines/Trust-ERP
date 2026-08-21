-- 074_phase00_lead_entity_type.sql — Lead Capture wizard: organization OR person leads
--
-- Until now every `prospects` row was implicitly a company (organization_name NOT NULL).
-- Marketing also captures individual people with no company behind them yet (a designer,
-- an architect, a homeowner). This migration makes that a first-class distinction rather
-- than forcing a fake organization_name — additive only, no new table, no rename.
--
-- display_name is a GENERATED column (never written directly — Postgres rejects an
-- INSERT/UPDATE that targets it) so it can NEVER drift from entity_type/organization_name/
-- person_name: it is recomputed by Postgres itself, not maintained by application code.

ALTER TABLE prospects ALTER COLUMN organization_name DROP NOT NULL;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'organization';
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_entity_type_check;
ALTER TABLE prospects ADD  CONSTRAINT prospects_entity_type_check
  CHECK (entity_type IN ('organization', 'person'));

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS person_name TEXT;

-- Never require both, never allow neither.
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_entity_name_check;
ALTER TABLE prospects ADD  CONSTRAINT prospects_entity_name_check
  CHECK (
    (entity_type = 'organization' AND organization_name IS NOT NULL)
    OR
    (entity_type = 'person' AND person_name IS NOT NULL)
  );

-- The canonical name for lists/search/duplicate-detection. GENERATED, not app-maintained.
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS display_name TEXT
  GENERATED ALWAYS AS (CASE WHEN entity_type = 'person' THEN person_name ELSE organization_name END) STORED;

CREATE INDEX IF NOT EXISTS idx_prospects_display_name_lower ON prospects (lower(display_name));
CREATE INDEX IF NOT EXISTS idx_prospects_person_name_lower  ON prospects (lower(person_name)) WHERE person_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_entity_type         ON prospects (entity_type);
