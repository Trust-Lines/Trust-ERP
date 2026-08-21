-- 083_region_visibility.sql — CRM Faz 4 (2026-08-07): an 8-person department, mixed
-- marketing_pr/sales_rep, each covering one or more of the 4 REAL T-Lines geographic
-- regions (lib/regions.ts REGIONS: TLINES_NE/TLINES_SE/TLINES_NW/CVW — already used on
-- lead_intake.region/projects.region for project codes + Dropbox paths).
--
-- Deliberately NOT the same thing as the existing `profiles.sales_region_id`/
-- `region_ids[]` (migrations 025/066) — those assign a person to a row in the `clients`
-- table (an account/territory concept), unrelated to real geography. Named
-- `assigned_regions` to avoid any confusion with that existing, unrelated column.

-- ── 1. profiles.assigned_regions — role-agnostic, multi-region ──────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_regions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_assigned_regions_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_assigned_regions_check
  CHECK (assigned_regions <@ ARRAY['TLINES_NE','TLINES_SE','TLINES_NW','CVW']::TEXT[]);
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_regions ON profiles USING GIN (assigned_regions);

-- ── 2. opportunities.region — new, manually-set field ────────────────────────────────
-- Marketing's capture wizard only ever asked for city/state, never a T-Lines region (the
-- Sales side's lead_intake.region only exists because Block 1 requires it for the project
-- code). No auto-guess from state — set explicitly in OpportunityQuickView so it's exact,
-- not a guess. NULL until someone sets it; see the RLS/access-function comments below for
-- what that means for visibility.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_region_check;
ALTER TABLE opportunities ADD  CONSTRAINT opportunities_region_check
  CHECK (region IS NULL OR region IN ('TLINES_NE','TLINES_SE','TLINES_NW','CVW'));
CREATE INDEX IF NOT EXISTS idx_opportunities_region ON opportunities (region) WHERE region IS NOT NULL;

-- ── 3. RLS — region-scoped read for the two individual-contributor roles ────────────
-- Rule (mirrors lib/access/regionScope.ts, the real enforcement point for the API layer;
-- this is defense-in-depth for the RLS-scoped list reads in
-- lib/marketing/opportunityRows.ts): once a user has ANY assigned_regions, a matching
-- region is REQUIRED — region match is sufficient BY ITSELF (not "region AND ownership"),
-- because the Sales Handoff pool already depends on a rep seeing unassigned deals in
-- their region, not just ones already assigned to them. A user with an EMPTY
-- assigned_regions array (not yet configured) falls back to the exact pre-Faz-4 rule —
-- nobody is locked out before Team page assignments are made.
--
-- NOTE: `x = ANY (subquery)` only auto-unnests when the subquery yields scalar rows —
-- a subquery whose single row is itself an ARRAY column (assigned_regions) makes
-- Postgres compare TEXT = TEXT[] directly and error (42883). `unnest()` inside the
-- subquery is required to turn it into one scalar row per region first.

-- sales_marketing_manager was previously only covered by opportunities_read_sales' same
-- stage-restricted condition as sales_rep — an existing inconsistency with the API layer
-- (lib/marketing/opportunityAccess.ts already treats it as full-access). Fixed here by
-- moving it into the manager-tier policy, where it belongs alongside marketing_manager/
-- general_manager/ops_manager.
DROP POLICY IF EXISTS opportunities_read_all ON opportunities;
CREATE POLICY opportunities_read_all ON opportunities
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager', 'sales_marketing_manager'))
  );

DROP POLICY IF EXISTS opportunities_read_own ON opportunities;
CREATE POLICY opportunities_read_own ON opportunities
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (
      CASE WHEN (SELECT COALESCE(array_length(p.assigned_regions, 1), 0) FROM profiles p WHERE p.id = auth.uid()) > 0
        THEN opportunities.region = ANY (SELECT unnest(p.assigned_regions) FROM profiles p WHERE p.id = auth.uid())
        ELSE EXISTS (
          SELECT 1 FROM prospects pr WHERE pr.id = opportunities.prospect_id
            AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
        )
      END
    )
  );

DROP POLICY IF EXISTS opportunities_read_sales ON opportunities;
CREATE POLICY opportunities_read_sales ON opportunities
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_rep')
    AND (
      CASE WHEN (SELECT COALESCE(array_length(p.assigned_regions, 1), 0) FROM profiles p WHERE p.id = auth.uid()) > 0
        THEN opportunities.region = ANY (SELECT unnest(p.assigned_regions) FROM profiles p WHERE p.id = auth.uid())
        ELSE (
          stage NOT IN ('new', 'marketing_qualification', 'on_hold') OR sales_owner_id = auth.uid()
        )
      END
    )
  );
