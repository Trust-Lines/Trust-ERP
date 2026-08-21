-- 045_customers.sql
-- Phase 1 — Customer Management V1 (see PROJECT-MASTER-PLAN.md §4.1/§5, AUDIT_PHASE0_CLIENTS.md).
--
-- Introduces the REAL End Customer model. Per the Phase 0 audit, `clients` is a
-- T-Lines Region/business-unit (NOT an end customer) and MUST NOT be renamed or
-- reused for this. These are NEW, additive tables and touch nothing existing.
--
--   customers          — a T-Lines end customer (e.g. "ABC Jewelry", a gas station,
--                        a restaurant chain). Owned by the T-Lines Sales/PM side.
--   customer_contacts  — the people at that customer (Owner, GM, Architect, ...).
--                        A customer can have many contacts.
--
-- Role model note: `profiles.role` is TEXT in the live DB (there is NO `user_role`
-- enum — see migration 023/025 history). All policies below compare role AS TEXT
-- via a direct `profiles` subquery, exactly like migration 029/043 (lead_intake).
-- Do NOT reference a `user_role` enum here.
--
-- ── AUTHORIZATION & AUDIT REQUIREMENTS (enforced in the API layer, next task) ──
-- RLS below is DEFENSE-IN-DEPTH (role-level). The API is the real gate and MUST:
--   • Use createAdminClient() + requireRole([...]) on every route (service-role
--     bypasses RLS — fail closed if the role can't be resolved).
--   • WRITE roles  : sales_rep, sales_marketing_manager, ops_manager, general_manager.
--   • READ roles   : the write set + tlines_pm + trustlines_pm.
-- Role authority model (2026-07-10): general_manager = full SYSTEM-WIDE authority
-- (replaces the removed `executive` role); ops_manager = full Trust-Lines OPERATIONAL
-- authority. Do NOT use `executive` in new code.
--   • logAudit() every create/update/delete with resource = 'customer:<id>' /
--     'customer_contact:<id>' (audit_log has no customer_id column; use `resource`).
--   • Validate input (name required; email/phone shape) and enforce the duplicate
--     check (Phase 1 task) against lower(name) — the index below backs it.
--   • customers carry NO PF / vendor price / margin fields, so there is no
--     tlines_pm sensitive-field concern here (kept intentionally out of scope).

-- ── CUSTOMERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                       -- end customer / company name
  code        TEXT,                                -- optional short code
  industry    TEXT,                                -- jeweler, gas station, restaurant, hotel...
  email       TEXT,
  phone       TEXT,
  website     TEXT,
  tax_id      TEXT,
  status      TEXT NOT NULL DEFAULT 'active',      -- active | inactive | prospect
  notes       TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,      -- soft-delete flags (repo convention)
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CUSTOMER CONTACTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_contacts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id            UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  title                  TEXT,                     -- free-text job title
  role_type              TEXT,                     -- owner|general_manager|project_manager|architect|
                                                   -- site_manager|purchasing|accounting|authorized_approver
  email                  TEXT,
  phone                  TEXT,
  is_primary             BOOLEAN NOT NULL DEFAULT FALSE,
  is_authorized_approver BOOLEAN NOT NULL DEFAULT FALSE,  -- relevant to Phase 5 external review link
  notes                  TEXT,
  created_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_archived            BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INDEXES (Postgres does NOT auto-index FKs; index hot filters — AGENTS §5) ──
-- Case-insensitive name for search + duplicate detection.
CREATE INDEX IF NOT EXISTS idx_customers_name_lower   ON customers (lower(name));
CREATE INDEX IF NOT EXISTS idx_customers_status       ON customers (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_created_by   ON customers (created_by);
-- FK + common lookups on contacts.
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_email    ON customer_contacts (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contacts_one_primary
  ON customer_contacts (customer_id) WHERE is_primary = TRUE AND deleted_at IS NULL;

-- ── updated_at triggers (reuse update_updated_at() from 001) ──
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_customer_contacts_updated_at ON customer_contacts;
CREATE TRIGGER trg_customer_contacts_updated_at
  BEFORE UPDATE ON customer_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW-LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Role read directly from profiles.role (TEXT model — no user_role enum), same
-- style as migration 029/043. Policies dropped first so this file is re-runnable.

-- customers: READ for Sales + T-Lines PM + Trust PM + ops/exec.
DROP POLICY IF EXISTS customers_read ON customers;
CREATE POLICY customers_read ON customers
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep',
                           'sales_marketing_manager','tlines_pm','trustlines_pm'))
  );

-- customers: WRITE (insert/update/delete) for Sales owners + ops/exec.
DROP POLICY IF EXISTS customers_write ON customers;
CREATE POLICY customers_write ON customers
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
  );

-- customer_contacts: mirror the parent customer's visibility (role-based).
DROP POLICY IF EXISTS customer_contacts_read ON customer_contacts;
CREATE POLICY customer_contacts_read ON customer_contacts
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep',
                           'sales_marketing_manager','tlines_pm','trustlines_pm'))
  );

DROP POLICY IF EXISTS customer_contacts_write ON customer_contacts;
CREATE POLICY customer_contacts_write ON customer_contacts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager'))
  );
