-- Migration 008: Replace intake_design with finalization, add construction_documents phase
-- Matches the 4 actual workflow phases: Finalization / Construction Documents / Production / Delivery

-- 1. Convert phase column to TEXT
ALTER TABLE projects ALTER COLUMN current_phase TYPE TEXT;

-- 2. Rename intake_design → finalization
UPDATE projects SET current_phase = 'finalization' WHERE current_phase = 'intake_design';

-- 3. Drop old phase enum
DROP TYPE IF EXISTS project_phase CASCADE;

-- 4. Create new phase enum
CREATE TYPE project_phase AS ENUM (
  'finalization',
  'construction_documents',
  'production',
  'delivery'
);

-- 5. Restore column
ALTER TABLE projects
  ALTER COLUMN current_phase TYPE project_phase USING current_phase::project_phase;
