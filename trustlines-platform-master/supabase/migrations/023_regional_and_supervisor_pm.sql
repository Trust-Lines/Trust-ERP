-- 023_regional_and_supervisor_pm.sql
-- Client PMs are now regional: each of the 4 regions (a client) has its own Client
-- PM who only sees that region. One global "Project Management Supervisor" oversees
-- ALL regions (and signs the PO supervisor box). A project gets BOTH assigned.

-- The region (client) a Client PM manages. NULL = not a regional PM.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pm_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- The single global Project Management Supervisor (general PM over every region).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_pm_supervisor BOOLEAN NOT NULL DEFAULT false;

-- The supervisor assigned to a project (auto-filled to the global supervisor).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pm_supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_pm_client ON profiles(pm_client_id) WHERE pm_client_id IS NOT NULL;
