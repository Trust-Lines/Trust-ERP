-- 049_customer_addresses_project_contacts.sql
-- Phase 1 — the last two Customer Management tables:
--   customer_addresses         — one customer can have many addresses (HQ, site, billing…).
--   project_customer_contacts  — which customer contacts are attached to a project
--                                (a project draws contacts from its customer).
--
-- Additive; RLS ENABLED. Role checks are TEXT (no user_role enum), same pattern as
-- 029/043/045/046. Role authority model: general_manager = full system-wide,
-- ops_manager = full Trust-Lines operational.

-- ── CUSTOMER ADDRESSES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label        TEXT,                          -- free label e.g. "HQ", "Store #4"
  address_type TEXT,                          -- billing | site | mailing | other
  line1        TEXT,
  line2        TEXT,
  city         TEXT,
  state        TEXT,
  postal_code  TEXT,
  country      TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  notes        TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_one_primary
  ON customer_addresses (customer_id) WHERE is_primary = TRUE AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── PROJECT ↔ CUSTOMER CONTACTS (junction) ────────────────────
CREATE TABLE IF NOT EXISTS project_customer_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_contact_id UUID NOT NULL REFERENCES customer_contacts(id) ON DELETE CASCADE,
  role_on_project     TEXT,                    -- e.g. approver, site_contact
  is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcc_project_contact ON project_customer_contacts (project_id, customer_contact_id);
CREATE INDEX IF NOT EXISTS idx_pcc_project ON project_customer_contacts (project_id);
CREATE INDEX IF NOT EXISTS idx_pcc_contact ON project_customer_contacts (customer_contact_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE customer_addresses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_customer_contacts ENABLE ROW LEVEL SECURITY;

-- customer_addresses: same visibility as customers (045).
DROP POLICY IF EXISTS customer_addresses_read ON customer_addresses;
CREATE POLICY customer_addresses_read ON customer_addresses
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep',
                           'sales_marketing_manager','tlines_pm','trustlines_pm'))
  );

DROP POLICY IF EXISTS customer_addresses_write ON customer_addresses;
CREATE POLICY customer_addresses_write ON customer_addresses
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
  );

-- project_customer_contacts: read for internal + sales + PM roles; write for the
-- roles that manage projects/customers (ops/gm/sales + both PMs).
DROP POLICY IF EXISTS pcc_read ON project_customer_contacts;
CREATE POLICY pcc_read ON project_customer_contacts
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager',
                           'tlines_pm','trustlines_pm','pm_millwork','pm_ceiling'))
  );

DROP POLICY IF EXISTS pcc_write ON project_customer_contacts;
CREATE POLICY pcc_write ON project_customer_contacts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','sales_rep','sales_marketing_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','sales_rep','sales_marketing_manager'))
  );
