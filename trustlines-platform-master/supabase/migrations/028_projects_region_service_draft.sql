-- 028_projects_region_service_draft.sql
-- Columns the Sales Meeting/Intake flow adds to projects. All are nullable /
-- default-safe so the EXISTING Trust NewProjectForm keeps working untouched:
--   • region / service_line default NULL (Trust doesn't set them),
--   • is_draft DEFAULT false  → Trust projects are visible immediately,
--   • delivered_to_trust_at NULL until a Sales draft is delivered.
--
-- A Sales intake creates a draft project (is_draft = true) on first autosave; on
-- "Deliver to Trust-Lines" it flips to is_draft = false + delivered_to_trust_at.
--
-- Region is one of six FIXED geographic codes (independent of the client). Keep
-- in sync with lib/regions.ts and region_service_sequences.region (migration 027).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS region                TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS service_line          TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_draft              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivered_to_trust_at TIMESTAMPTZ;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_region_check;
ALTER TABLE projects ADD CONSTRAINT projects_region_check
  CHECK (region IS NULL OR region IN
    ('TLINES_NE','TLINES_SE','TLINES_NW','CVW','TLINES_HQ','TLINES_TC'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_service_line_check;
ALTER TABLE projects ADD CONSTRAINT projects_service_line_check
  CHECK (service_line IS NULL OR service_line IN
    ('store_maker','design_build','premium_store_fitout'));

CREATE INDEX IF NOT EXISTS idx_projects_region       ON projects(region)       WHERE region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_service_line ON projects(service_line) WHERE service_line IS NOT NULL;
-- Hot filter: hide undelivered drafts from Trust list queries.
CREATE INDEX IF NOT EXISTS idx_projects_draft        ON projects(is_draft)     WHERE is_draft = true;
