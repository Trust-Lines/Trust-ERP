-- 075_phase00_opportunities_core.sql — PHASE 00.5 Opportunity Core (moved ahead of 00.4
-- Potentials at explicit user decision, 2026-07-22): "the primary actionable business
-- list must be Opportunities, not Leads."
--
-- An Opportunity is the definable, commercially-actionable need under a Lead
-- (PHASE-00-...md §1/§3). A Lead may have zero, one, or many Opportunities. This table
-- is SEPARATE from `prospects` — a Lead is never itself an Opportunity (decided in the
-- 00.1 compatibility map). Nothing here creates a `projects` row, reserves a global
-- project number, or touches Dropbox — that only ever happens at Sales `sales_accepted`
-- (still a future task; this migration only carries the field to record the timestamp
-- once that flow exists).
--
-- 🔴 AUTOMATION RULE THIS TABLE SET EXISTS TO PROTECT (2026-07-22 decision):
-- Opportunities are SYSTEM-CREATED by the classification engine (lib/marketing/
-- opportunityEngine.ts), never by a manual "create Opportunity" button in the normal
-- Marketing workflow. To keep repeated classification runs idempotent (never spawn
-- duplicate Opportunities for the same still-open need), every system-created row has
-- auto_managed = TRUE and a partial unique index enforces at most ONE open (non-closed)
-- auto-managed Opportunity per Prospect. A Lead with two genuinely distinct needs (e.g.
-- two locations with different scopes) gets a second Opportunity through a distinct
-- manual "split" action (marketing_manager/general_manager only) that sets
-- auto_managed = FALSE on the earlier one first — that action is NOT built in this
-- migration; only the schema constraint that makes it safe to add later.

CREATE TABLE IF NOT EXISTS opportunities (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id              UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  customer_id              UUID REFERENCES customers(id) ON DELETE SET NULL,  -- set only at Closed Won (future task)
  primary_contact_id       UUID REFERENCES prospect_contacts(id) ON DELETE SET NULL,
  title                    TEXT NOT NULL,
  description              TEXT,
  opportunity_type         TEXT,
  project_types            TEXT[] NOT NULL DEFAULT '{}',
  stage                    TEXT NOT NULL DEFAULT 'new',
  source_label             TEXT,
  marketing_owner_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sales_owner_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  estimated_location_count INTEGER,
  estimated_value          NUMERIC,
  currency                 TEXT,
  probability              INTEGER,
  expected_close_date      DATE,
  deadline                 DATE,
  urgency                  TEXT,
  budget_status            TEXT,
  decision_maker_status    TEXT,
  next_action              TEXT,
  next_action_date         DATE,
  sales_handoff_at         TIMESTAMPTZ,
  sales_accepted_at        TIMESTAMPTZ,
  closed_at                TIMESTAMPTZ,
  closed_reason            TEXT,
  -- System-classification bookkeeping (mirrors prospects.classification_reasons/074's
  -- rule-version discipline — no magic numbers, every threshold named in the engine).
  auto_managed             BOOLEAN NOT NULL DEFAULT TRUE,
  classification_reasons   TEXT[] NOT NULL DEFAULT '{}',
  classification_rule_version INTEGER NOT NULL DEFAULT 1,
  -- Emergency admin correction — general_manager only, audited, NOT part of the normal
  -- Marketing/Sales workflow (2026-07-22 decision). A stage set this way is still subject
  -- to being recalculated by the engine on the next real data change; this is a one-off
  -- repair, not a persistent override flag.
  admin_corrected           BOOLEAN NOT NULL DEFAULT FALSE,
  admin_correction_reason   TEXT,
  deleted_at                TIMESTAMPTZ,
  created_by                UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;
ALTER TABLE opportunities ADD  CONSTRAINT opportunities_stage_check
  CHECK (stage IN (
    'new','marketing_qualification','qualified_for_sales','sales_handoff','sales_accepted',
    'discovery','sales_design','proposal','negotiation','closed_won','closed_lost','on_hold'
  ));

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_type_check;
ALTER TABLE opportunities ADD  CONSTRAINT opportunities_type_check
  CHECK (opportunity_type IS NULL OR opportunity_type IN (
    'new_construction','full_remodel','small_remodel','repair','upgrade',
    'items_only','design_only','multi_location_rollout','unknown'
  ));

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_admin_correction_check;
ALTER TABLE opportunities ADD  CONSTRAINT opportunities_admin_correction_check
  CHECK (admin_corrected = FALSE OR admin_correction_reason IS NOT NULL);

-- A Lead may have multiple locations under one Opportunity (multi-location rollout).
CREATE TABLE IF NOT EXISTS opportunity_locations (
  opportunity_id       UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  prospect_location_id UUID NOT NULL REFERENCES prospect_locations(id) ON DELETE CASCADE,
  scope_summary        TEXT,
  estimated_start_date DATE,
  deadline              DATE,
  priority              INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, prospect_location_id)
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_opportunities_prospect        ON opportunities (prospect_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage           ON opportunities (stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_marketing_owner ON opportunities (marketing_owner_id) WHERE marketing_owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_sales_owner     ON opportunities (sales_owner_id) WHERE sales_owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_created_by      ON opportunities (created_by);

-- At most one OPEN auto-managed Opportunity per Prospect — the idempotency guarantee
-- the classification engine relies on to never spawn duplicates on repeated runs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_one_auto_open_per_prospect
  ON opportunities (prospect_id)
  WHERE auto_managed = TRUE AND deleted_at IS NULL AND stage NOT IN ('closed_won','closed_lost');

CREATE INDEX IF NOT EXISTS idx_opportunity_locations_location ON opportunity_locations (prospect_location_id);

-- ── updated_at trigger ───────────────────────────────────────
DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON opportunities;
CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW-LEVEL SECURITY ────────────────────────────────────────
-- Same shape as prospects (072): marketing_pr scoped to Opportunities under a Prospect
-- they created/own/are assigned to; marketing_manager/general_manager full;
-- ops_manager READ ONLY oversight (no write policy, mirrors 072 exactly). Sales-side
-- visibility (handoff/accept) is NOT enabled yet — no policy for sales roles here on
-- purpose, since sales_owner_id assignment and the handoff action don't exist yet
-- (documented gap, next task). Service-role API routes still do their own explicit
-- authorization check (defense-in-depth, same as every other Marketing table).
ALTER TABLE opportunities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_locations  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunities_read_all ON opportunities;
CREATE POLICY opportunities_read_all ON opportunities
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
  );

DROP POLICY IF EXISTS opportunities_read_own ON opportunities;
CREATE POLICY opportunities_read_own ON opportunities
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND EXISTS (
      SELECT 1 FROM prospects pr WHERE pr.id = opportunities.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS opportunities_write_manage ON opportunities;
CREATE POLICY opportunities_write_manage ON opportunities
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
  );

-- marketing_pr cannot write Opportunities directly (they are system-created); the API
-- layer writes via the service-role admin client on the engine's behalf, scoped to
-- Prospects marketing_pr is already allowed to touch — this policy exists only so a
-- future direct-write path has an explicit, narrow grant instead of silently relying on
-- the admin client bypassing RLS.
DROP POLICY IF EXISTS opportunities_update_own ON opportunities;
CREATE POLICY opportunities_update_own ON opportunities
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND EXISTS (
      SELECT 1 FROM prospects pr WHERE pr.id = opportunities.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND EXISTS (
      SELECT 1 FROM prospects pr WHERE pr.id = opportunities.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS opportunity_locations_read ON opportunity_locations;
CREATE POLICY opportunity_locations_read ON opportunity_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('marketing_manager','general_manager','ops_manager')
    )
    OR EXISTS (
      SELECT 1 FROM opportunities o
      JOIN prospects pr ON pr.id = o.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE o.id = opportunity_locations.opportunity_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS opportunity_locations_write ON opportunity_locations;
CREATE POLICY opportunity_locations_write ON opportunity_locations
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM opportunities o
      JOIN prospects pr ON pr.id = o.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE o.id = opportunity_locations.opportunity_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM opportunities o
      JOIN prospects pr ON pr.id = o.prospect_id
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE o.id = opportunity_locations.opportunity_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

-- No policy at all for Sales / tlines_pm / trustlines_pm / designers / supply /
-- production / qc / warehouse / logistics / accounting — RLS default-denies. Sales
-- visibility is intentionally deferred to the handoff task (documented gap above).
