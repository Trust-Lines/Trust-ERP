-- 112_prospects_no_region_visible_everywhere.sql — 2026-09-17
--
-- Found live: "Cco, llc" / "Town mart" (public survey submissions — surveys can't collect
-- an internal region code, so `regions = '{}'` by design, see 111 and the "Missing region"
-- team-gap section) became INVISIBLE to a region-scoped marketing_pr after 111 switched
-- visibility to `pr.regions && assigned_regions` — an empty array never overlaps with
-- anything, so a record nobody has triaged into a region yet was hidden from everyone
-- EXCEPT a marketing_pr with no assigned region at all. That's backwards: an untriaged
-- record is exactly the kind of thing the assigned people most need to see (it's sitting in
-- their "Missing region" gap list), not the one thing they're blocked from opening.
--
-- Fix: a record with no region assigned yet is visible to EVERY marketing_pr regardless of
-- their own assigned_regions, same as it already was to a marketing_pr with none.

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
          THEN COALESCE(array_length(pr.regions, 1), 0) = 0 OR pr.regions && p.assigned_regions
          ELSE TRUE
        END
      )
  );
$$;

DROP POLICY IF EXISTS prospects_read_own ON prospects;
CREATE POLICY prospects_read_own ON prospects
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (
      CASE WHEN (SELECT COALESCE(array_length(p.assigned_regions, 1), 0) FROM profiles p WHERE p.id = auth.uid()) > 0
        THEN COALESCE(array_length(prospects.regions, 1), 0) = 0
          OR prospects.regions && (SELECT p.assigned_regions FROM profiles p WHERE p.id = auth.uid())
        ELSE TRUE
      END
    )
  );
