-- TEST DB CATCH-UP: migrations 105 → 125 in one go.
-- Run ONLY on the TEST database (Supabase → SQL Editor → paste → Run).
-- Every file below is safe to re-run (IF NOT EXISTS / DROP IF EXISTS / ON CONFLICT DO NOTHING).
-- Wrapped in one transaction: if anything fails, nothing is applied.

BEGIN;


-- ════════════════════════════════════════════════════════════════
-- 105_create_document_approval_rpc.sql
-- ════════════════════════════════════════════════════════════════
-- 105_create_document_approval_rpc.sql — restores a critical, undocumented gap: the
-- `create_document_approval` RPC that BOTH real call sites (app/api/projects/[id]/doc-approvals/
-- route.ts's "initiate" mode, and app/api/dropbox/link-file/route.ts) depend on to insert every
-- single stage row of every document approval chain — was referenced everywhere in the
-- application code and documented in SYSTEM_ARCHITECTURE.md/CURRENT_SYSTEM_STATE.md ("Satırlar
-- create_document_approval RPC ile eklenir — PostgREST şema-cache'ini atlamak için"), but had NO
-- CREATE FUNCTION anywhere in supabase/migrations/. It must have been created directly against
-- some environment's live database via the SQL editor at some point and never captured as a
-- migration — meaning THIS dev database (and any fresh environment built from migrations alone)
-- never had it at all.
--
-- Found live, 2026-08-28 (Roadmap Month 2, tasks 12/13 — Shop Drawings / Trust PM approvals):
-- calling the RPC with the exact parameter names both real call sites use failed with
-- "Could not find the function public.create_document_approval(...) in the schema cache" — i.e.
-- initiating ANY document's approval chain (plan_layout, proposal, construction_drawings,
-- shop_drawing, item bundles, PO, PF — every doc type, not just the one this task started from)
-- was silently broken on this database. This migration writes down what the application code has
-- always assumed exists, so it is no longer tribal knowledge living only in a production
-- database's history.
--
-- The exact signature is dictated by the two real call sites — do not rename parameters.

CREATE OR REPLACE FUNCTION create_document_approval(
  p_document_id  UUID,
  p_project_id   UUID,
  p_requested_by UUID,
  p_assigned_to  UUID,
  p_status       TEXT,
  p_stage        INTEGER,
  p_doc_type     TEXT,
  p_version_num  INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO document_approvals (
    document_id, project_id, requested_by, assigned_to, status, stage, doc_type, version_num
  ) VALUES (
    p_document_id, p_project_id, p_requested_by, p_assigned_to, p_status, p_stage, p_doc_type, p_version_num
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- SECURITY DEFINER runs as the function owner (bypassing the caller's RLS on document_approvals,
-- the same trust boundary every other RPC in this codebase uses) — every real caller already runs
-- behind the service-role admin client + its own requireRole()/access check, so this does not
-- widen who can reach the function, only lets the intended callers' inserts succeed.
REVOKE ALL ON FUNCTION create_document_approval FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_document_approval TO authenticated, service_role;



-- ════════════════════════════════════════════════════════════════
-- 106_fix_lead_tasks_rls_recursion.sql
-- ════════════════════════════════════════════════════════════════
-- 106_fix_lead_tasks_rls_recursion.sql — fixes a real, live "infinite recursion detected in
-- policy for relation lead_tasks" error (42P17), reported by the user running the app directly
-- (not caught earlier this session because every prior test used the service-role admin client,
-- which bypasses RLS entirely and never exercises this path).
--
-- Root cause — a genuine circular RLS reference between two tables' policies:
--   • lead_intake_sales_rw (migration 043) checks lead_tasks:
--       EXISTS (SELECT 1 FROM lead_tasks t WHERE t.lead_intake_id = lead_intake.id AND t.assignee_id = auth.uid())
--   • lead_tasks_sales_rw (migrations 081/101) checks lead_intake:
--       EXISTS (SELECT 1 FROM lead_intake li WHERE li.id = lead_intake_id AND ...)
-- Evaluating either table's RLS requires evaluating the other's, which requires the first's again
-- — Postgres detects this cycle at query-rewrite time and refuses, for EVERY query against either
-- table run through an RLS-enforced (non-admin) client, regardless of row count.
--
-- Fix: break the cycle with a SECURITY DEFINER helper. A SECURITY DEFINER function owned by the
-- migration-running role reads lead_tasks WITHOUT re-triggering lead_tasks' own RLS policy (RLS
-- only applies to the querying session's role for a table it queries directly through PostgREST/
-- the session role — a SECURITY DEFINER function's internal query runs as the function owner,
-- which is not subject to RLS unless that table has FORCE ROW LEVEL SECURITY, which none of these
-- do). This is the same "helper function to short-circuit a cross-table RLS check" pattern
-- CLAUDE.md/AGENTS.md's `auth_role()` (migration 002) already established for is_internal_role().

CREATE OR REPLACE FUNCTION has_lead_task_assigned_to_me(p_lead_intake_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lead_tasks t
    WHERE t.lead_intake_id = p_lead_intake_id AND t.assignee_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION has_lead_task_assigned_to_me FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_lead_task_assigned_to_me TO authenticated, service_role;

DROP POLICY IF EXISTS lead_intake_sales_rw ON lead_intake;
CREATE POLICY lead_intake_sales_rw ON lead_intake
  FOR ALL
  USING (
    created_by = auth.uid()
    OR assignee_id = auth.uid()
    OR has_lead_task_assigned_to_me(lead_intake.id)
    OR EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR assignee_id = auth.uid()
    OR has_lead_task_assigned_to_me(lead_intake.id)
    OR EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')
  );

-- lead_tasks' own policy is UNCHANGED — it still checks lead_intake directly. That direction is
-- now safe: lead_intake's policy no longer queries lead_tasks directly (it goes through the
-- SECURITY DEFINER function instead), so there is no cycle left to detect.



-- ════════════════════════════════════════════════════════════════
-- 107_campaign_survey_template_general.sql
-- ════════════════════════════════════════════════════════════════
-- 107_campaign_survey_template_general.sql — 2026-08-28
--
-- Adds the new default, always-on "General Survey" (T Lines Store Passport —
-- components/platform/survey/GeneralSurvey.tsx) to the set of survey templates a
-- campaign's `survey_template` column may hold. Widens migration 102's CHECK
-- constraint from ('none', 'soccer_challenge') to include 'general'.

ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_survey_template_check;
ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_survey_template_check
  CHECK (survey_template IN ('none', 'soccer_challenge', 'general'));



-- ════════════════════════════════════════════════════════════════
-- 108_prospects_region_visibility.sql
-- ════════════════════════════════════════════════════════════════
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



-- ════════════════════════════════════════════════════════════════
-- 109_marketing_pr_no_region_sees_all.sql
-- ════════════════════════════════════════════════════════════════
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



-- ════════════════════════════════════════════════════════════════
-- 110_campaign_survey_template_quick.sql
-- ════════════════════════════════════════════════════════════════
-- 110_campaign_survey_template_quick.sql — 2026-09-17
--
-- Adds the new "Quick Survey" (T Lines short-form — components/platform/survey/
-- QuickSurvey.tsx) to the set of survey templates a campaign's `survey_template` column
-- may hold. Widens migration 107's CHECK constraint from
-- ('none', 'soccer_challenge', 'general') to include 'quick'.

ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_survey_template_check;
ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_survey_template_check
  CHECK (survey_template IN ('none', 'soccer_challenge', 'general', 'quick'));



-- ════════════════════════════════════════════════════════════════
-- 111_prospects_multi_region.sql
-- ════════════════════════════════════════════════════════════════
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



-- ════════════════════════════════════════════════════════════════
-- 112_prospects_no_region_visible_everywhere.sql
-- ════════════════════════════════════════════════════════════════
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



-- ════════════════════════════════════════════════════════════════
-- 113_projects_prospect_link.sql
-- ════════════════════════════════════════════════════════════════
-- 113_projects_prospect_link.sql — 2026-09-17
--
-- Marketing-only "Add Project" feature: marketing_pr can log a project Trust-Lines already
-- delivered for a Contact, purely as a historical record ("ben bu projeyi yaptım" — not a
-- new live pipeline item, not touched from Sales's own screens at all). Needed a way to find
-- these again from the Contact's own page, so `projects` gets a nullable back-reference —
-- every existing/normal project (created via Sales's acceptOpportunity flow) leaves this
-- NULL, unaffected.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_prospect_id ON projects (prospect_id) WHERE prospect_id IS NOT NULL;



-- ════════════════════════════════════════════════════════════════
-- 114_prospects_effective_created_at.sql
-- ════════════════════════════════════════════════════════════════
-- 114_prospects_effective_created_at.sql — 2026-09-17
--
-- "Date Created" on the Contacts list must show and sort by the real ClickUp date when a
-- Contact came from ClickUp (external_created_at), falling back to our own created_at for
-- survey-native/manually-created Contacts that never had one. The UI already displayed that
-- COALESCE — the sort (app/api/marketing/prospects/route.ts) couldn't replicate it through
-- plain .order() on either column alone: sorting by created_at lost the real ClickUp dates,
-- sorting by external_created_at buried every NULL-dated Contact at the bottom regardless of
-- how recently it was actually added ("Cco, llc"/"Town mart" going missing under the Date
-- Created sort — found live). A real generated column lets both display and sort agree.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS effective_created_at TIMESTAMPTZ
  GENERATED ALWAYS AS (COALESCE(external_created_at, created_at)) STORED;

CREATE INDEX IF NOT EXISTS idx_prospects_effective_created_at ON prospects (effective_created_at DESC);



-- ════════════════════════════════════════════════════════════════
-- 115_marketing_campaigns_visible_to_all_pr.sql
-- ════════════════════════════════════════════════════════════════
-- 115_marketing_campaigns_visible_to_all_pr.sql — 2026-09-17
--
-- marketing_campaigns_read (086) only let a marketing_pr see campaigns they personally
-- owned/created — same restriction Contacts had until 108/109 removed it ("a marketing_pr
-- should see everything Marketing has, not just their own rows"). Found live: the Campaigns
-- & Surveys page showed completely empty for the real marketing_pr account, because every
-- existing campaign was created by a different (admin/general_manager) account. Write access
-- stays exactly as it was — marketing_pr can still only edit/delete campaigns they own or
-- created (marketing_campaigns_write_own, unchanged); this only widens what they can *see*.

DROP POLICY IF EXISTS marketing_campaigns_read ON marketing_campaigns;
CREATE POLICY marketing_campaigns_read ON marketing_campaigns
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager', 'marketing_pr'))
  );

-- Same ownership restriction existed one level down too — a marketing_pr could now see a
-- campaign but its submission count / interaction rows would still silently read as zero.
DROP POLICY IF EXISTS survey_submissions_read ON survey_submissions;
CREATE POLICY survey_submissions_read ON survey_submissions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager', 'marketing_pr'))
  );

DROP POLICY IF EXISTS campaign_interactions_read ON campaign_interactions;
CREATE POLICY campaign_interactions_read ON campaign_interactions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager', 'marketing_pr'))
  );



-- ════════════════════════════════════════════════════════════════
-- 116_prospect_contact_notes_editable.sql
-- ════════════════════════════════════════════════════════════════
-- 116_prospect_contact_notes_editable.sql — 2026-09-18
--
-- prospect_contact_notes (092/095) could be posted and deleted, never edited — a typo or a
-- correction meant deleting the whole comment and re-posting it, losing the original
-- timestamp/thread position. Direct instruction: notes editable by their own author. Adds an
-- edited_at marker so the UI can show "(edited)" without losing the original created_at.

ALTER TABLE prospect_contact_notes ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;



-- ════════════════════════════════════════════════════════════════
-- 117_mail_templates.sql
-- ════════════════════════════════════════════════════════════════
-- 117_mail_templates.sql (2026-09-24)
-- Marketing mail templates for the Contacts query-builder's bulk-download/bulk-send workflow
-- (2026-09-23/24 decisions: Contacts is query-first now, results feed a template instead of a
-- free-browsed list). body_html supports {{token}} placeholders resolved against a prospect
-- row — see lib/marketing/mailTemplates.ts MERGE_FIELDS for the exact supported set.

CREATE TABLE IF NOT EXISTS mail_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mail_templates_active ON mail_templates (created_at DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_mail_templates_updated_at ON mail_templates;
CREATE TRIGGER trg_mail_templates_updated_at
  BEFORE UPDATE ON mail_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: every route that reads/writes this table uses the admin (service-role) client and does
-- its own role check (MARKETING_WRITE_ROLES) in app code, same pattern as marketing_campaigns
-- — enable RLS with no policies so a stray client-side (anon/RLS) query gets nothing, not the
-- whole table.
ALTER TABLE mail_templates ENABLE ROW LEVEL SECURITY;



-- ════════════════════════════════════════════════════════════════
-- 118_web_projects.sql
-- ════════════════════════════════════════════════════════════════
-- Public website "Projects" content. Written by the ERP marketing screens
-- (service-role API layer), read by the website (anon key, published rows only).
-- Idempotent: safe to run more than once.

create table if not exists public.web_projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,                 -- URL: /projects/<slug>
  title           text not null,                        -- "Teddy, Milford"
  category        text not null check (category in ('c-store', 'truck-stops', 'grocery')),
  location        text not null,                        -- card ribbon + meta bar, e.g. "Milford, CT, USA"
  project_type    text,                                 -- meta bar "Type", e.g. "C Store Remodel"
  year_built      integer,                              -- meta bar "Date"
  cover_image_url text not null,                        -- ImageKit URL, gallery card image
  cover_image_alt text,
  is_published    boolean not null default false,
  sort_order      integer not null default 0,           -- lower = earlier; ties: newest first
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Top carousel photos on the project page (any number, ordered).
create table if not exists public.web_project_photos (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.web_projects(id) on delete cascade,
  image_url   text not null,
  alt         text,
  sort_order  integer not null default 0
);

-- Body blocks under the meta bar (any number, ordered).
--   image_url set  -> text + photo block (photo side alternates automatically)
--   image_url null -> full-width text block
create table if not exists public.web_project_sections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.web_projects(id) on delete cascade,
  heading     text,
  body        text,
  image_url   text,
  image_alt   text,
  sort_order  integer not null default 0
);

create index if not exists web_project_photos_project_idx   on public.web_project_photos(project_id, sort_order);
create index if not exists web_project_sections_project_idx on public.web_project_sections(project_id, sort_order);

create or replace function public.web_touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists web_projects_touch on public.web_projects;
create trigger web_projects_touch before update on public.web_projects
  for each row execute function public.web_touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.web_projects         enable row level security;
alter table public.web_project_photos   enable row level security;
alter table public.web_project_sections enable row level security;

-- Who may write: the ERP roles allowed to edit marketing content (see migration 084).
-- marketing_pr is read-only and is intentionally not listed.
-- security definer so the policy can read profiles regardless of the caller's own RLS.
create or replace function public.web_can_edit() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('marketing_manager', 'general_manager', 'ops_manager')
  )
$$;

-- Website (anon) reads published projects only; editors also see drafts.
drop policy if exists "web_projects public read" on public.web_projects;
create policy "web_projects public read" on public.web_projects
  for select using (is_published or public.web_can_edit());

drop policy if exists "web_photos public read" on public.web_project_photos;
create policy "web_photos public read" on public.web_project_photos
  for select using (exists (select 1 from public.web_projects p
                            where p.id = project_id and (p.is_published or public.web_can_edit())));

drop policy if exists "web_sections public read" on public.web_project_sections;
create policy "web_sections public read" on public.web_project_sections
  for select using (exists (select 1 from public.web_projects p
                            where p.id = project_id and (p.is_published or public.web_can_edit())));

-- Direct-client writes: second line of defence. The ERP writes through its
-- service-role API layer (which checks the role itself and bypasses RLS).
drop policy if exists "web_projects edit" on public.web_projects;
create policy "web_projects edit" on public.web_projects
  for all using (public.web_can_edit()) with check (public.web_can_edit());

drop policy if exists "web_photos edit" on public.web_project_photos;
create policy "web_photos edit" on public.web_project_photos
  for all using (public.web_can_edit()) with check (public.web_can_edit());

drop policy if exists "web_sections edit" on public.web_project_sections;
create policy "web_sections edit" on public.web_project_sections
  for all using (public.web_can_edit()) with check (public.web_can_edit());



-- ════════════════════════════════════════════════════════════════
-- 119_web_settings.sql
-- ════════════════════════════════════════════════════════════════
-- Editable website settings (page hero text/images now, hero video etc. later).
-- One row per key, value is JSON. Depends on 118 (web_can_edit()).
-- PUBLIC: this table is readable by anyone with the anon key. Store only hero
-- text and ImageKit URLs here, never secrets or internal data.
-- Idempotent: safe to run more than once.

create table if not exists public.web_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create or replace function public.web_touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists web_settings_touch on public.web_settings;
create trigger web_settings_touch before update on public.web_settings
  for each row execute function public.web_touch_updated_at();

alter table public.web_settings enable row level security;

drop policy if exists "web_settings public read" on public.web_settings;
create policy "web_settings public read" on public.web_settings
  for select using (true);

drop policy if exists "web_settings edit" on public.web_settings;
create policy "web_settings edit" on public.web_settings
  for all using (public.web_can_edit()) with check (public.web_can_edit());

-- Projects page header (edited from the ERP; image is an ImageKit URL).
insert into public.web_settings (key, value) values
  ('projects_page', '{
    "eyebrow": "Tlines Gallery",
    "heading": "Projects",
    "description": "",
    "hero_image_url": "",
    "hero_image_alt": ""
  }'::jsonb)
on conflict (key) do nothing;



-- ════════════════════════════════════════════════════════════════
-- 120_web_can_edit_marketing_pr.sql
-- ════════════════════════════════════════════════════════════════
-- 120: marketing_pr may now edit the public website content too (same as the ERP API layer,
-- lib/marketing/roles.ts MARKETING_WRITE_ROLES). Keeps the RLS "second line of defence" from
-- 118 consistent with the API. Idempotent.

create or replace function public.web_can_edit() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('marketing_pr', 'marketing_manager', 'general_manager', 'ops_manager')
  )
$$;



-- ════════════════════════════════════════════════════════════════
-- 121_web_blog.sql
-- ════════════════════════════════════════════════════════════════
-- Public website "Blog & News" content. Written by the ERP marketing screens
-- (service-role API layer), read by the website (anon key, published rows only).
-- Depends on 118 (web_can_edit(), web_touch_updated_at()) and 119 (web_settings).
-- (The website repo calls this file 120_web_blog.sql; in the ERP repo 120 was already taken.)
-- Idempotent: safe to run more than once.

create table if not exists public.web_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,                 -- URL: /blog/<slug>
  title           text not null,
  excerpt         text not null default '',             -- card text + article intro
  category        text not null check (category in ('industry-news', 'tips-and-tricks', 'success-stories', 'company-updates')),
  author          text not null default '',
  cover_image_url text not null,                        -- ImageKit URL: card + article hero
  cover_image_alt text,
  published_at    date not null default current_date,   -- shown date; a future date keeps it hidden until then
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Article body blocks (any number, ordered).
--   image_url set  -> text + photo block
--   image_url null -> text block
create table if not exists public.web_post_sections (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.web_posts(id) on delete cascade,
  heading     text,
  body        text,
  image_url   text,
  image_alt   text,
  sort_order  integer not null default 0
);

create index if not exists web_posts_published_idx      on public.web_posts(is_published, published_at desc);
create index if not exists web_post_sections_post_idx   on public.web_post_sections(post_id, sort_order);

drop trigger if exists web_posts_touch on public.web_posts;
create trigger web_posts_touch before update on public.web_posts
  for each row execute function public.web_touch_updated_at();

alter table public.web_posts         enable row level security;
alter table public.web_post_sections enable row level security;

-- Website (anon) reads live posts only; editors also see drafts and scheduled posts.
drop policy if exists "web_posts public read" on public.web_posts;
create policy "web_posts public read" on public.web_posts
  for select using ((is_published and published_at <= current_date) or public.web_can_edit());

drop policy if exists "web_post_sections public read" on public.web_post_sections;
create policy "web_post_sections public read" on public.web_post_sections
  for select using (exists (select 1 from public.web_posts p
                            where p.id = post_id
                              and ((p.is_published and p.published_at <= current_date) or public.web_can_edit())));

-- Direct-client writes: second line of defence (the ERP writes via its service-role API layer).
drop policy if exists "web_posts edit" on public.web_posts;
create policy "web_posts edit" on public.web_posts
  for all using (public.web_can_edit()) with check (public.web_can_edit());

drop policy if exists "web_post_sections edit" on public.web_post_sections;
create policy "web_post_sections edit" on public.web_post_sections
  for all using (public.web_can_edit()) with check (public.web_can_edit());

-- Blog & News page header (public: hero text and an ImageKit URL only).
insert into public.web_settings (key, value) values
  ('blog_page', '{
    "eyebrow": "Tlines Journal",
    "heading": "Blog & News",
    "description": "",
    "hero_image_url": "",
    "hero_image_alt": ""
  }'::jsonb)
on conflict (key) do nothing;



-- ════════════════════════════════════════════════════════════════
-- 122_web_leads.sql
-- ════════════════════════════════════════════════════════════════
-- 122_web_leads.sql — Website contact-form / newsletter inbox.
--
-- Submissions from the public website (sm.tlines.us) land HERE, deliberately separate from
-- `prospects`: marketing reviews them and converts the good ones into a Contact by hand
-- (web_leads.prospect_id remembers the link). Nothing from the website ever touches
-- prospects/customers/projects on its own.
--
-- The website never writes to this table directly. It POSTs to the ERP's public endpoint
-- (/api/public/web-leads), which validates, rate-limits and inserts with the service role.
-- RLS therefore grants the anon role NOTHING (no policy = deny); only the marketing roles
-- (via web_can_edit(), migrations 118 + 120) may read/write from a signed-in client.
-- Idempotent: safe to run more than once.

create table if not exists public.web_leads (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null default 'contact' check (kind in ('contact', 'newsletter')),
  name                 text,
  phone                text,
  email                text,
  company              text,
  store_location       text,
  store_condition      text,                 -- as sent: 'New Store' | 'Remodeling'
  store_type           text,                 -- as sent: 'C-store' | 'Truck Stop' | 'Grocery' | 'Other'
  message              text,
  consent_accepted     boolean not null default false,
  consent_text_version text,
  consent_at           timestamptz,
  source_page          text,                 -- page the form was on (optional, sent by the site)
  utm                  jsonb,                -- utm_* parameters (optional, sent by the site)
  ip_hash              text,                 -- SHA-256 of the IP, abuse tracing only — never the raw IP
  status               text not null default 'new' check (status in ('new', 'contacted', 'converted', 'spam', 'archived')),
  internal_note        text,
  prospect_id          uuid references public.prospects(id) on delete set null,
  handled_by           uuid references public.profiles(id) on delete set null,
  handled_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists web_leads_status_created_idx on public.web_leads(status, created_at desc);
create index if not exists web_leads_email_idx          on public.web_leads(lower(email));

drop trigger if exists web_leads_touch on public.web_leads;
create trigger web_leads_touch before update on public.web_leads
  for each row execute function public.web_touch_updated_at();

alter table public.web_leads enable row level security;

-- Marketing roles only. The ERP API layer (service role) is the real gate; this is the second line.
drop policy if exists "web_leads marketing" on public.web_leads;
create policy "web_leads marketing" on public.web_leads
  for all using (public.web_can_edit()) with check (public.web_can_edit());



-- ════════════════════════════════════════════════════════════════
-- 123_web_work_types.sql
-- ════════════════════════════════════════════════════════════════
-- (The website repo calls this file 121_web_work_types.sql; in the ERP repo 121/122 were already taken.)
-- Kinds of work a website project can include (Ceiling fixtures, Shelving, ...).
-- The Projects page shows them as filter tiles (Figma node 650:10316) and each
-- project lists the ones it covered. Managed from the ERP marketing screens.
-- Depends on 118 (web_projects, web_can_edit(), web_touch_updated_at()).
-- Idempotent: safe to run more than once.

create table if not exists public.web_work_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),  -- stored on projects
  label       text not null,                                                   -- tile caption, e.g. "Ceiling fixtures"
  icon_url    text,                                                            -- cream icon on transparent bg (ImageKit); null = built-in icon for the default slugs
  sort_order  integer not null default 0,                                      -- lower = earlier in the 3-column grid
  is_active   boolean not null default true,                                   -- inactive types disappear from the site
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists web_work_types_touch on public.web_work_types;
create trigger web_work_types_touch before update on public.web_work_types
  for each row execute function public.web_touch_updated_at();

alter table public.web_work_types enable row level security;

drop policy if exists "web_work_types public read" on public.web_work_types;
create policy "web_work_types public read" on public.web_work_types
  for select using (is_active or public.web_can_edit());

-- Direct-client writes: second line of defence (the ERP writes via its service-role API layer).
drop policy if exists "web_work_types edit" on public.web_work_types;
create policy "web_work_types edit" on public.web_work_types
  for all using (public.web_can_edit()) with check (public.web_can_edit());

-- The six types from the design. The site falls back to these same six if the table is empty.
insert into public.web_work_types (slug, label, sort_order) values
  ('ceiling-fixtures', 'Ceiling fixtures', 10),
  ('shelving',         'Shelving',          20),
  ('mill-work',        'Mill-work',         30),
  ('branding',         'Branding',          40),
  ('signage',          'Signage',           50),
  ('furniture',        'Furniture',         60)
on conflict (slug) do nothing;

-- Which of them each project covers (slugs from web_work_types).
alter table public.web_projects
  add column if not exists work_types text[] not null default '{}';

create index if not exists web_projects_work_types_idx on public.web_projects using gin (work_types);

-- Reject slugs that are not in web_work_types. To retire a type, set is_active = false
-- instead of deleting it (the site ignores unknown or inactive slugs on old projects).
create or replace function public.web_projects_check_work_types() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from unnest(new.work_types) as t(slug)
    where not exists (select 1 from public.web_work_types w where w.slug = t.slug)
  ) then
    raise exception 'web_projects.work_types contains a slug that is not in web_work_types';
  end if;
  return new;
end $$;

drop trigger if exists web_projects_work_types_check on public.web_projects;
create trigger web_projects_work_types_check before insert or update of work_types on public.web_projects
  for each row execute function public.web_projects_check_work_types();



-- ════════════════════════════════════════════════════════════════
-- 124_prospect_created_by_label.sql
-- ════════════════════════════════════════════════════════════════
-- 124_prospect_created_by_label.sql — 2026-10-08
--
-- NACS 26 survey: the booth staff pick "who is entering this" (Layal, Justin, T, Naim, Merve,
-- Hashem) on the second screen, and it must show as a "Created by" cell on the Contact's profile.
-- `prospects.created_by` (a profile id) cannot hold it: survey Prospects are attributed to the
-- campaign owner, and the representatives are not all ERP users. So: a plain text label.
--
-- Additive only. The application writes/reads this column defensively, so deploying code before
-- this migration is applied is safe — "Created by" simply stays empty until it is.

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS created_by_label TEXT;



-- ════════════════════════════════════════════════════════════════
-- 125_campaign_interaction_excel_import.sql
-- ════════════════════════════════════════════════════════════════
-- 125_campaign_interaction_excel_import.sql — 2026-10-08
--
-- "Import Excel" (Marketing → Import) links every imported Contact to its campaign so the show
-- appears under "Shows attended". campaign_interactions.interaction_type is limited by a CHECK
-- (086: 'survey_submission', widened by 089: + 'clickup_import'); add 'excel_import' while KEEPING
-- every value already allowed/in use. Additive and safe: the application records the interaction
-- tolerantly, so importing works (without the "Shows attended" line) until this is applied.

ALTER TABLE campaign_interactions DROP CONSTRAINT IF EXISTS campaign_interactions_type_check;
ALTER TABLE campaign_interactions ADD  CONSTRAINT campaign_interactions_type_check
  CHECK (interaction_type IN ('survey_submission', 'clickup_import', 'excel_import'));


COMMIT;
