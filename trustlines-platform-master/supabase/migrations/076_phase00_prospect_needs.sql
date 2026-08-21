-- 076_phase00_prospect_needs.sql — PHASE 00.5b Need-level model (2026-07-22 correction)
--
-- 🔴 THE MODEL ERROR THIS MIGRATION FIXES: 075 stored project-need answers (has_active_
-- project, deadline, project_types, timing, layout_available...) directly on `prospects`
-- and enforced AT MOST ONE open auto-managed Opportunity per prospect_id. That's wrong —
-- a real Lead/company can have MULTIPLE separate project needs at once (e.g. "Manhattan
-- Full Remodel" AND "Brooklyn New Construction" under one company), each of which must
-- classify and convert to its own Opportunity independently. User correction (2026-07-22):
-- "A Prospect may have multiple open Potentials. A Prospect may have multiple open
-- Opportunities... Classification must run per prospect_need, not per Prospect."
-- 
-- This migration is ADDITIVE + non-destructive (CLAUDE.md — never destructively rename or
-- drop). It does NOT touch or remove the legacy project-need columns on `prospects`
-- (organization_name, project_types, has_active_project, deadline, etc. from migrations
-- 072/073 stay exactly as they are — existing reads/RLS keep working). New code simply
-- stops treating those columns as the source of truth for classification; they are kept
-- only as historical/backfill source. See lib/marketing/opportunityEngine.ts (rewritten
-- alongside this migration) for the new per-Need classification entrypoint.

-- ── PROSPECT NEEDS — one row per distinct project need under a Lead ────────────
CREATE TABLE IF NOT EXISTS prospect_needs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id           UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  location_id           UUID REFERENCES prospect_locations(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  has_active_project    BOOLEAN,
  project_types         TEXT[] NOT NULL DEFAULT '{}',
  scope_types           TEXT[] NOT NULL DEFAULT '{}',
  deadline              DATE,
  expected_start_date   DATE,
  layout_available      BOOLEAN,
  site_ready            BOOLEAN,
  budget_min            NUMERIC,
  budget_max            NUMERIC,
  currency              TEXT,
  timing                TEXT,
  source                TEXT,
  -- Need lifecycle (distinct from classification — a need can be 'open' while its
  -- classification is still 'unclassified' pending more information).
  status                TEXT NOT NULL DEFAULT 'open',
  -- System-computed, mirrors lib/marketing/classification.ts's 4-way result but at the
  -- Need level: a Need with insufficient info stays 'unclassified' ("Lead only" has no
  -- meaning at need-granularity — the parent Prospect is still the Lead).
  classification         TEXT NOT NULL DEFAULT 'unclassified',
  classification_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  classification_rule_version INTEGER NOT NULL DEFAULT 1,
  deleted_at            TIMESTAMPTZ,
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prospect_needs DROP CONSTRAINT IF EXISTS prospect_needs_status_check;
ALTER TABLE prospect_needs ADD  CONSTRAINT prospect_needs_status_check
  CHECK (status IN ('open', 'disqualified', 'archived'));

ALTER TABLE prospect_needs DROP CONSTRAINT IF EXISTS prospect_needs_classification_check;
ALTER TABLE prospect_needs ADD  CONSTRAINT prospect_needs_classification_check
  CHECK (classification IN ('unclassified', 'potential', 'opportunity', 'disqualified'));

CREATE INDEX IF NOT EXISTS idx_prospect_needs_prospect ON prospect_needs (prospect_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_needs_location  ON prospect_needs (location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_needs_created_by ON prospect_needs (created_by);

DROP TRIGGER IF EXISTS trg_prospect_needs_updated_at ON prospect_needs;
CREATE TRIGGER trg_prospect_needs_updated_at
  BEFORE UPDATE ON prospect_needs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── PROSPECT POTENTIALS — a future-possibility need, one auto-managed row per open Need ─
CREATE TABLE IF NOT EXISTS prospect_potentials (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id                 UUID NOT NULL REFERENCES prospect_needs(id) ON DELETE CASCADE,
  prospect_id             UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,  -- denormalized for cheap list/RLS
  title                   TEXT NOT NULL,
  potential_type          TEXT,
  status                  TEXT NOT NULL DEFAULT 'identified',
  estimated_start_date    DATE,
  target_contact_date     DATE,
  estimated_quantity      INTEGER,
  estimated_value         NUMERIC,
  currency                TEXT,
  confidence              TEXT,
  assigned_to             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_contact_at         TIMESTAMPTZ,
  next_contact_at         TIMESTAMPTZ,
  converted_opportunity_id UUID,  -- FK added below, after `opportunities` already exists
  auto_managed            BOOLEAN NOT NULL DEFAULT TRUE,
  classification_reasons  TEXT[] NOT NULL DEFAULT '{}',
  classification_rule_version INTEGER NOT NULL DEFAULT 1,
  notes                   TEXT,
  deleted_at              TIMESTAMPTZ,
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prospect_potentials DROP CONSTRAINT IF EXISTS prospect_potentials_status_check;
ALTER TABLE prospect_potentials ADD  CONSTRAINT prospect_potentials_status_check
  CHECK (status IN ('identified', 'nurture', 'waiting_timing', 'contact_due', 'converted', 'lost', 'cancelled'));

ALTER TABLE prospect_potentials DROP CONSTRAINT IF EXISTS prospect_potentials_converted_opp_fkey;
ALTER TABLE prospect_potentials ADD  CONSTRAINT prospect_potentials_converted_opp_fkey
  FOREIGN KEY (converted_opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_potentials_prospect ON prospect_potentials (prospect_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_potentials_assigned ON prospect_potentials (assigned_to) WHERE assigned_to IS NOT NULL;

-- At most one OPEN auto-managed Potential per Need (mirrors the Opportunity rule below,
-- but keyed on need_id, not prospect_id — the whole point of this migration).
CREATE UNIQUE INDEX IF NOT EXISTS idx_potentials_one_auto_open_per_need
  ON prospect_potentials (need_id)
  WHERE auto_managed = TRUE AND deleted_at IS NULL AND status NOT IN ('converted', 'lost', 'cancelled');

DROP TRIGGER IF EXISTS trg_prospect_potentials_updated_at ON prospect_potentials;
CREATE TRIGGER trg_prospect_potentials_updated_at
  BEFORE UPDATE ON prospect_potentials FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── OPPORTUNITIES: link to the Need that produced it, re-key the uniqueness rule ────────
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS need_id UUID REFERENCES prospect_needs(id) ON DELETE CASCADE;

-- 🔴 REMOVE the old prospect-level constraint (this is the "at most one per prospect"
-- rule the user explicitly told us to remove).
DROP INDEX IF EXISTS idx_opportunities_one_auto_open_per_prospect;

-- ── BACKFILL — preserve every existing Opportunity, non-destructively ──────────────────
-- Step A: every Prospect that already has an Opportunity gets exactly one Need created
-- from that Prospect's legacy project-need columns (safe 1:1 — 075's constraint meant
-- there was never more than one Opportunity per Prospect before this migration), and the
-- Opportunity is linked to it.
WITH source_prospects AS (
  SELECT DISTINCT p.id AS prospect_id, p.display_name, p.notes, p.has_active_project,
         p.project_types, p.scope_types, p.deadline, p.expected_start_date,
         p.layout_available, p.site_ready, p.budget_range, p.timing, p.source_label,
         p.classification_reasons, p.created_by, p.created_at
  FROM prospects p
  WHERE EXISTS (SELECT 1 FROM opportunities o WHERE o.prospect_id = p.id AND o.need_id IS NULL)
),
inserted_needs AS (
  INSERT INTO prospect_needs (
    prospect_id, title, description, has_active_project, project_types, scope_types,
    deadline, expected_start_date, layout_available, site_ready, timing, source,
    status, classification, classification_reasons, classification_rule_version,
    created_by, created_at
  )
  SELECT
    sp.prospect_id, sp.display_name || ' — Initial Need',
    CASE WHEN sp.budget_range IS NOT NULL THEN 'Budget range (legacy, unparsed): ' || sp.budget_range ELSE sp.notes END,
    sp.has_active_project, COALESCE(sp.project_types, '{}'), COALESCE(sp.scope_types, '{}'),
    sp.deadline, sp.expected_start_date, sp.layout_available, sp.site_ready, sp.timing, sp.source_label,
    'open', 'opportunity', to_jsonb(COALESCE(sp.classification_reasons, '{}')), 1,
    sp.created_by, sp.created_at
  FROM source_prospects sp
  RETURNING id, prospect_id
)
UPDATE opportunities o
SET need_id = n.id
FROM inserted_needs n
WHERE o.prospect_id = n.prospect_id AND o.need_id IS NULL;

-- Step B: any remaining Prospect that captured project-need answers but has NO
-- Opportunity yet (still just a Lead/Potential) also gets its one initial Need, so the
-- Needs tab and future re-classification have something to work with — unlinked to any
-- Opportunity (none exists).
INSERT INTO prospect_needs (
  prospect_id, title, description, has_active_project, project_types, scope_types,
  deadline, expected_start_date, layout_available, site_ready, timing, source,
  status, classification, classification_reasons, classification_rule_version,
  created_by, created_at
)
SELECT
  p.id, p.display_name || ' — Initial Need',
  CASE WHEN p.budget_range IS NOT NULL THEN 'Budget range (legacy, unparsed): ' || p.budget_range ELSE p.notes END,
  p.has_active_project, COALESCE(p.project_types, '{}'), COALESCE(p.scope_types, '{}'),
  p.deadline, p.expected_start_date, p.layout_available, p.site_ready, p.timing, p.source_label,
  'open',
  CASE WHEN p.status IN ('opportunity_candidate','qualified_for_sales','converted') THEN 'opportunity'
       WHEN p.status IN ('potential','nurture') THEN 'potential'
       WHEN p.status = 'disqualified' THEN 'disqualified'
       ELSE 'unclassified' END,
  to_jsonb(COALESCE(p.classification_reasons, '{}')), 1,
  p.created_by, p.created_at
FROM prospects p
WHERE NOT EXISTS (SELECT 1 FROM prospect_needs pn WHERE pn.prospect_id = p.id)
  AND (
    p.has_active_project IS NOT NULL OR array_length(p.project_types, 1) > 0
    OR array_length(p.scope_types, 1) > 0 OR p.deadline IS NOT NULL OR p.expected_start_date IS NOT NULL
    OR p.layout_available IS NOT NULL OR p.site_ready IS NOT NULL OR p.budget_range IS NOT NULL
    OR p.timing IS NOT NULL OR p.notes IS NOT NULL
  );

-- Step C: every pre-existing Opportunity is now linked (Step A is 1:1 complete) — safe
-- to require need_id on all FUTURE rows too.
ALTER TABLE opportunities ALTER COLUMN need_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_need ON opportunities (need_id);

-- The real uniqueness rule going forward: at most one OPEN auto-managed Opportunity PER
-- NEED, not per Prospect. A Prospect with 3 Needs can have up to 3 open Opportunities.
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_one_auto_open_per_need
  ON opportunities (need_id)
  WHERE auto_managed = TRUE AND deleted_at IS NULL AND stage NOT IN ('closed_won', 'closed_lost');

-- ── ROW-LEVEL SECURITY (same shape as prospect_locations/072 — child of a Prospect) ─────
ALTER TABLE prospect_needs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_potentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospect_needs_read ON prospect_needs;
CREATE POLICY prospect_needs_read ON prospect_needs
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_needs.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_needs_write ON prospect_needs;
CREATE POLICY prospect_needs_write ON prospect_needs
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_needs.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_needs.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_potentials_read ON prospect_potentials;
CREATE POLICY prospect_potentials_read ON prospect_potentials
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_potentials.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_potentials_write ON prospect_potentials;
CREATE POLICY prospect_potentials_write ON prospect_potentials
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_potentials.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_potentials.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

-- No policy for Sales / tlines_pm / trustlines_pm / designers / supply / production / qc /
-- warehouse / logistics / accounting — RLS default-denies, same as every other Marketing table.
