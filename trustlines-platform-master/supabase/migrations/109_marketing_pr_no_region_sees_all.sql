-- 109_marketing_pr_no_region_sees_all.sql — 2026-09-15
--
-- Explicit product decision (user, live testing right after 108 was applied): a
-- marketing_pr with NO assigned_regions should see ALL Prospects/Potentials/
-- Opportunities company-wide, not just the ones they personally created/own/are
-- assigned to. This reverses the "no region → fall back to ownership-only" safe default
-- that 083_region_visibility.sql and 108_prospects_region_visibility.sql both used —
-- that default made sense as a "nobody sees everything by accident before Team page
-- assignments are made" guard, but the user has now explicitly said the opposite is what
-- they want: unassigned = unrestricted, assigned = scoped to that region.
--
-- Once a marketing_pr DOES have an assigned_regions entry, behavior is UNCHANGED — they
-- stay scoped to their region(s), exactly as 083/108 already set up. Only the ELSE branch
-- of that CASE changes, from the ownership check to unconditional TRUE.
--
-- Scope: marketing_pr only (the role this was reported against). sales_rep's fallback in
-- opportunities_read_sales (083) is a different, stage-based rule and is left untouched —
-- not part of this request.

CREATE OR REPLACE FUNCTION marketing_pr_can_see_prospect(p_prospect_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM prospects pr, profiles p
    WHERE p.id = auth.uid() AND p.role = 'marketing_pr' AND pr.id = p_prospect_id
      AND (
        CASE WHEN COALESCE(array_length(p.assigned_regions, 1), 0) > 0
          THEN pr.region = ANY (SELECT unnest(p.assigned_regions))
          ELSE TRUE
        END
      )
  );
$$;
-- prospect_contacts_read / prospect_locations_read / prospect_needs_read /
-- prospect_potentials_read (108) all call this function directly — no need to recreate
-- those policies, the new function body applies the moment this replaces it.

DROP POLICY IF EXISTS prospects_read_own ON prospects;
CREATE POLICY prospects_read_own ON prospects
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (
      CASE WHEN (SELECT COALESCE(array_length(p.assigned_regions, 1), 0) FROM profiles p WHERE p.id = auth.uid()) > 0
        THEN prospects.region = ANY (SELECT unnest(p.assigned_regions) FROM profiles p WHERE p.id = auth.uid())
        ELSE TRUE
      END
    )
  );

DROP POLICY IF EXISTS opportunities_read_own ON opportunities;
CREATE POLICY opportunities_read_own ON opportunities
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (
      CASE WHEN (SELECT COALESCE(array_length(p.assigned_regions, 1), 0) FROM profiles p WHERE p.id = auth.uid()) > 0
        THEN opportunities.region = ANY (SELECT unnest(p.assigned_regions) FROM profiles p WHERE p.id = auth.uid())
        ELSE TRUE
      END
    )
  );
