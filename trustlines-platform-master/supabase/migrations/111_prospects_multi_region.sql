-- 111_prospects_multi_region.sql — 2026-09-17
--
-- A Contact (prospects row) can be a real member of more than one ClickUp Contacts list at
-- once (confirmed live: "GoMart" sits in both the NW and SE lists — same task id shows up
-- fetching either source). The import script dedupes by external_ref, so a task claimed by
-- one region's fetch is silently skipped when a later region's fetch hits the same task —
-- the record only ever gets ONE region, and disappears from the other region's filter even
-- though ClickUp genuinely lists it there too.
--
-- `prospects.region` (singular) stays exactly as-is — it remains the PRIMARY region for
-- ownership/assignment purposes (RLS's "which marketing_pr owns/can edit this" logic keeps
-- using it unchanged, see 108/109). This migration adds `regions` (plural, TEXT[]) purely
-- for VISIBILITY: which region filters a Contact should show up under. Every existing row
-- backfills to a single-element array matching its current `region` — a no-op for every
-- Contact except the handful with genuine dual ClickUp membership, which the app will
-- update explicitly once found (see the GoMart fix applied 2026-09-17).
--
-- Opportunities/Potentials are deliberately NOT touched here — a deal/site is physically in
-- one place, "which region does this belong to" has one right answer there. Only a Contact
-- (a person/company, not a location) can legitimately belong to more than one.

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS regions TEXT[] NOT NULL DEFAULT '{}';

UPDATE prospects SET regions = ARRAY[region] WHERE region IS NOT NULL AND regions = '{}';

CREATE INDEX IF NOT EXISTS idx_prospects_regions ON prospects USING GIN (regions);

-- RLS visibility now checks regions (array overlap) instead of region (scalar equality) —
-- same CASE/assigned_regions logic as 109, just switched to the array-aware operator.
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
          THEN pr.regions && p.assigned_regions
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
        THEN prospects.regions && (SELECT p.assigned_regions FROM profiles p WHERE p.id = auth.uid())
        ELSE TRUE
      END
    )
  );

-- The one confirmed dual-membership case found live before this migration existed (already
-- manually corrected in the app: region flipped from SE to NW since the NW list is its
-- "true home") — restore its SE membership onto `regions` now that both can coexist.
UPDATE prospects SET regions = ARRAY['TLINES_NW', 'TLINES_SE']
WHERE external_ref = '86c8hzjnx' AND external_source = 'clickup';
