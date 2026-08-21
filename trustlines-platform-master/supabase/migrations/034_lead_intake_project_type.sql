-- 034_lead_intake_project_type.sql
-- The lead's Project Type (New Construction / Small Remodel / Full Remodel / BID /
-- ITEMS) — a selectable field on the intake form, shown in the Leads board's
-- "Project Type" column. (This replaces the earlier placeholder that showed the
-- region there.) Keep values in sync with lib/sales/projectTypes.ts.

ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS project_type TEXT;

ALTER TABLE lead_intake DROP CONSTRAINT IF EXISTS lead_intake_project_type_check;
ALTER TABLE lead_intake ADD CONSTRAINT lead_intake_project_type_check
  CHECK (project_type IS NULL OR project_type IN
    ('New Construction','Small Remodel','Full Remodel','BID','ITEMS'));
