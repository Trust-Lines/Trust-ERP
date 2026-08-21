-- 104_opportunity_potential_external_project_code.sql (2026-08-19)
-- The CRM board's PROJECT # column only ever reads our OWN internal `projects.code`
-- (set once a deal is handed off to Sales) — every imported ClickUp Opportunity/Potential
-- shows "—" there even though ClickUp's own "PROJECT #" custom field (e.g. "417-NE") was
-- already captured into memory as `externalProjectCode` (lib/clickup/importOpportunitiesMapping.ts)
-- and silently folded into the free-text `description`, never its own column. Mirrors
-- `prospects.external_project_code` (migration 094), same idea for Opportunities/Potentials.

ALTER TABLE opportunities        ADD COLUMN IF NOT EXISTS external_project_code TEXT;
ALTER TABLE prospect_potentials  ADD COLUMN IF NOT EXISTS external_project_code TEXT;
