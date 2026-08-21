-- 072_phase00_prospect_core.sql — PHASE 00.3 Prospect Core
--
-- First real Marketing data layer (PHASE-00-MARKETING-LEAD-OPPORTUNITY-ORIGINATION.md
-- §3 + AUDIT_PHASE00_MARKETING.md §8). A Prospect is a Marketing-owned lead/company
-- record — NOT a Customer (customers/customer_contacts, migration 045, stay untouched)
-- and NOT an Opportunity (a separate table, decided in the 00.1 compatibility map,
-- lands in 00.5). `lead_intake` is NOT modified or overloaded as the Prospect table —
-- it keeps working exactly as it does today (§9 of the phase doc forbids touching it).
--
-- 🔴 THE RULE THIS TABLE SET EXISTS TO PROTECT (AUDIT_PHASE00_MARKETING.md §1, §7.1):
-- Marketing must never create a `projects` row, reserve a global project number, or
-- create a Dropbox folder. Nothing in this migration references `projects`,
-- `project_number_counter`, or Dropbox in any way — that boundary holds by ABSENCE,
-- not by a denial rule, exactly like marketing_pr/marketing_manager's permission set
-- (migration 070) holds it by never granting page.projects.
--
-- Role model (CLAUDE.md / AGENTS.md): profiles.role is TEXT. There is NO `user_role`
-- enum in the live DB — never ALTER TYPE. Roles live in role_definitions.name (TEXT).
--
-- ── AUTHORIZATION & AUDIT REQUIREMENTS (enforced in the API layer, this task) ──
-- RLS below is DEFENSE-IN-DEPTH, same layering as every other table (SYSTEM_ARCHITECTURE
-- §6.4). The API is the real gate and MUST:
--   • Use createAdminClient() + requireRole([...]) on every route.
--   • marketing_pr: read/write only Prospects they created OR are assigned to (and
--     Contacts/Locations under those Prospects).
--   • marketing_manager / general_manager: read/write ALL Prospects.
--   • ops_manager: READ ONLY (system-wide oversight) — no write policy, on purpose.
--   • Sales / tlines_pm / trustlines_pm / designers / supply / production / qc /
--     warehouse / logistics / accounting: NO access (no policy = deny).
--   • logAudit() every create/update/archive with resource = 'prospect:<id>' /
--     'prospect_contact:<id>' / 'prospect_location:<id>'.
--   • Duplicate suggestion (normalized org name / website domain / email / phone) is
--     ADVISORY ONLY — never auto-merge, never block creation.

-- ── PROSPECTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospects (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name           TEXT NOT NULL,
  brand_name                  TEXT,
  industry                    TEXT,
  website                     TEXT,
  main_email                  TEXT,
  main_phone                  TEXT,
  company_size                TEXT,
  location_count              INTEGER,
  status                      TEXT NOT NULL DEFAULT 'captured',
  source_id                   UUID,             -- FK lands with marketing_sources (Phase 00.6)
  campaign_id                 UUID,             -- FK lands with marketing_campaigns (Phase 00.6)
  event_id                    UUID,             -- FK lands with marketing_events (Phase 00.6)
  owner_id                    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_marketing_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_id                 UUID REFERENCES customers(id) ON DELETE SET NULL,  -- set only at Closed Won (00.10)
  is_archived                 BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at                  TIMESTAMPTZ,
  created_by                  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_status_check;
ALTER TABLE prospects ADD  CONSTRAINT prospects_status_check
  CHECK (status IN (
    'captured','enrichment','potential','nurture','opportunity_candidate',
    'qualified_for_sales','converted','disqualified','archived'
  ));

-- ── PROSPECT CONTACTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospect_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  title            TEXT,
  role_type        TEXT,             -- free-text (owner|gm|architect|purchasing|... — no closed list yet)
  email            TEXT,
  phone            TEXT,
  linkedin_url     TEXT,
  is_decision_maker BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  contact_consent  BOOLEAN NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PROSPECT LOCATIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospect_locations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id             UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  location_name           TEXT,
  address_line_1          TEXT,
  address_line_2          TEXT,
  city                    TEXT,
  state                   TEXT,
  postal_code             TEXT,
  country                 TEXT,
  location_type           TEXT,       -- free-text (flagship|branch|planned|...)
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  store_status            TEXT,       -- free-text (open|closed|planned|under_construction|...)
  estimated_remodel_date  DATE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INDEXES (Postgres does NOT auto-index FKs; index hot filters — AGENTS §5) ──
-- Normalized org name for search + duplicate suggestion.
CREATE INDEX IF NOT EXISTS idx_prospects_org_name_lower ON prospects (lower(organization_name));
CREATE INDEX IF NOT EXISTS idx_prospects_website_lower  ON prospects (lower(website)) WHERE website IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_email_lower    ON prospects (lower(main_email)) WHERE main_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_assigned       ON prospects (assigned_marketing_user_id) WHERE assigned_marketing_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_owner          ON prospects (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_created_by     ON prospects (created_by);
CREATE INDEX IF NOT EXISTS idx_prospects_status         ON prospects (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_customer       ON prospects (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_contacts_prospect     ON prospect_contacts (prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_contacts_email_lower  ON prospect_contacts (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_contacts_one_primary
  ON prospect_contacts (prospect_id) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_prospect_locations_prospect    ON prospect_locations (prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_locations_city_state  ON prospect_locations (lower(city), lower(state)) WHERE city IS NOT NULL;

-- ── updated_at triggers (reuse update_updated_at() from 001) ──
DROP TRIGGER IF EXISTS trg_prospects_updated_at ON prospects;
CREATE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_prospect_contacts_updated_at ON prospect_contacts;
CREATE TRIGGER trg_prospect_contacts_updated_at
  BEFORE UPDATE ON prospect_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_prospect_locations_updated_at ON prospect_locations;
CREATE TRIGGER trg_prospect_locations_updated_at
  BEFORE UPDATE ON prospect_locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW-LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE prospects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_locations ENABLE ROW LEVEL SECURITY;

-- prospects: READ ALL for marketing_manager / general_manager / ops_manager (oversight,
-- read-only — ops_manager gets NO write policy below, on purpose per spec).
DROP POLICY IF EXISTS prospects_read_all ON prospects;
CREATE POLICY prospects_read_all ON prospects
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
  );

-- prospects: READ OWN for marketing_pr (created it, owns it, or is currently assigned).
DROP POLICY IF EXISTS prospects_read_own ON prospects;
CREATE POLICY prospects_read_own ON prospects
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (created_by = auth.uid() OR assigned_marketing_user_id = auth.uid() OR owner_id = auth.uid())
  );

-- prospects: WRITE (insert/update) for marketing_manager / general_manager — everything.
DROP POLICY IF EXISTS prospects_write_manage ON prospects;
CREATE POLICY prospects_write_manage ON prospects
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
  );

-- prospects: INSERT for marketing_pr — may only create records attributed to themselves.
DROP POLICY IF EXISTS prospects_insert_own ON prospects;
CREATE POLICY prospects_insert_own ON prospects
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND created_by = auth.uid()
  );

-- prospects: UPDATE for marketing_pr — only records they created, own, or are assigned.
DROP POLICY IF EXISTS prospects_update_own ON prospects;
CREATE POLICY prospects_update_own ON prospects
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (created_by = auth.uid() OR assigned_marketing_user_id = auth.uid() OR owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (created_by = auth.uid() OR assigned_marketing_user_id = auth.uid() OR owner_id = auth.uid())
  );

-- prospect_contacts: mirror the parent Prospect's visibility exactly.
DROP POLICY IF EXISTS prospect_contacts_read ON prospect_contacts;
CREATE POLICY prospect_contacts_read ON prospect_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('marketing_manager','general_manager','ops_manager')
    )
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_contacts.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_contacts_write ON prospect_contacts;
CREATE POLICY prospect_contacts_write ON prospect_contacts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_contacts.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_contacts.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

-- prospect_locations: same shape as prospect_contacts.
DROP POLICY IF EXISTS prospect_locations_read ON prospect_locations;
CREATE POLICY prospect_locations_read ON prospect_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('marketing_manager','general_manager','ops_manager')
    )
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_locations.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_locations_write ON prospect_locations;
CREATE POLICY prospect_locations_write ON prospect_locations
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_locations.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_locations.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

-- No policy at all for Sales / tlines_pm / trustlines_pm / designers / supply / production /
-- qc / warehouse / logistics / accounting — RLS default-denies (no SELECT/write policy
-- matches their role, so every one of those roles sees zero Prospect rows).
