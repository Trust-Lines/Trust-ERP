-- 108_prospects_region_visibility.sql — 2026-09-15
--
-- 🔴 Closes a real gap left by 083_region_visibility.sql. That migration added the
-- "assigned_regions → region match is enough, empty → fall back to ownership" CASE to
-- `opportunities` RLS only, because at the time `prospects.region` and
-- `prospect_potentials.region` didn't exist yet — they were added later, in
-- 088_clickup_import_fields.sql and 100_deals_unified_board_parity.sql respectively.
-- Nobody went back and extended the same region-aware rule to Prospects/Potentials/their
-- child tables — they were left on the pre-Faz-4, ownership-only rule from
-- 072_phase00_prospect_core.sql / 076_phase00_prospect_needs.sql, no matter what a
-- marketing_pr's assigned_regions said.
--
-- Confirmed live (2026-09-15): a real marketing_pr account (assigned_regions = '{}',
-- 0 prospects created/owned/assigned) saw 0 rows in Lead Cloud, Potentials, AND
-- Opportunities — Opportunities being empty was correctly the safe pre-Faz-4 default for
-- an unconfigured user, but Prospects/Potentials would have stayed empty even AFTER
-- assigning that user a region, unlike Opportunities. That inconsistency is the actual
-- bug: assigning a region on the Team page should make someone see their region's Leads
-- the same way it already does for their Opportunities.
--
-- Fix: a SECURITY DEFINER helper (same pattern as has_lead_task_assigned_to_me/106 and
-- create_document_approval/105) encodes the one CASE rule once — "region match if any
-- region is assigned, else the original ownership check" — checked against the PARENT
-- Prospect's own `region` column, since prospect_contacts/prospect_locations/
-- prospect_needs/prospect_potentials all hang off one Prospect and never had their own
-- independent region concept. Only SELECT (read) policies are widened here — WRITE stays
-- ownership-only, exactly mirroring how 083 only ever widened Opportunities' READ
-- policies, never its write ones.

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
          ELSE (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
        END
      )
  );
$$;

REVOKE ALL ON FUNCTION marketing_pr_can_see_prospect FROM PUBLIC;
GRANT EXECUTE ON FUNCTION marketing_pr_can_see_prospect TO authenticated, service_role;

-- ── prospects itself — operates directly on prospects.id/.region, no helper needed ──────
DROP POLICY IF EXISTS prospects_read_own ON prospects;
CREATE POLICY prospects_read_own ON prospects
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (
      CASE WHEN (SELECT COALESCE(array_length(p.assigned_regions, 1), 0) FROM profiles p WHERE p.id = auth.uid()) > 0
        THEN prospects.region = ANY (SELECT unnest(p.assigned_regions) FROM profiles p WHERE p.id = auth.uid())
        ELSE (created_by = auth.uid() OR assigned_marketing_user_id = auth.uid() OR owner_id = auth.uid())
      END
    )
  );

-- ── child tables — same rule, via the parent Prospect's region ──────────────────────────
DROP POLICY IF EXISTS prospect_contacts_read ON prospect_contacts;
CREATE POLICY prospect_contacts_read ON prospect_contacts
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR marketing_pr_can_see_prospect(prospect_contacts.prospect_id)
  );

DROP POLICY IF EXISTS prospect_locations_read ON prospect_locations;
CREATE POLICY prospect_locations_read ON prospect_locations
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR marketing_pr_can_see_prospect(prospect_locations.prospect_id)
  );

DROP POLICY IF EXISTS prospect_needs_read ON prospect_needs;
CREATE POLICY prospect_needs_read ON prospect_needs
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR marketing_pr_can_see_prospect(prospect_needs.prospect_id)
  );

DROP POLICY IF EXISTS prospect_potentials_read ON prospect_potentials;
CREATE POLICY prospect_potentials_read ON prospect_potentials
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR marketing_pr_can_see_prospect(prospect_potentials.prospect_id)
  );
