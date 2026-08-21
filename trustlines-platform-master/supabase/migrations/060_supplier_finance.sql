-- 060_supplier_finance.sql
-- Phase 9 — Supplier finance backbone (PROJECT-MASTER-PLAN §Phase 9):
--   * Supplier profiles      — enrich the existing `suppliers` table (contact / tax / terms).
--   * Supplier invoice receipts — `supplier_invoices` (what Trust Lines owes a vendor).
--   * Multi-payment tracking    — `supplier_payments` (many payments per invoice / on-account).
--   * Supplier & project totals — computed in the API from the two tables above.
--
-- SECURITY: this is vendor purchase cost. `tlines_pm` (client-side PM) must NEVER see it.
-- Read = ops/gm/accountant/accounting/trustlines_pm.  Write = ops/gm/accountant/accounting.
-- Additive & re-runnable; RLS ENABLED (TEXT roles, EXISTS-on-profiles idiom).

-- ── Supplier profile columns ──────────────────────────────────
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone         TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address       TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_office    TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_number    TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes         TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Supplier invoices (receipts we owe the vendor) ────────────
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,   -- optional: on-account invoices allowed
  invoice_number TEXT,
  invoice_date   DATE,
  currency       TEXT NOT NULL DEFAULT 'USD',   -- USD | TL | EUR
  amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  description    TEXT,
  dropbox_path   TEXT,                          -- linked receipt file (never deleted/overwritten)
  status         TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | partial | paid (kept in sync by the API)
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_currency_check;
ALTER TABLE supplier_invoices ADD CONSTRAINT supplier_invoices_currency_check CHECK (currency IN ('USD','TL','EUR'));
ALTER TABLE supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_status_check;
ALTER TABLE supplier_invoices ADD CONSTRAINT supplier_invoices_status_check CHECK (status IN ('unpaid','partial','paid'));

CREATE INDEX IF NOT EXISTS idx_sinv_supplier ON supplier_invoices(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sinv_project  ON supplier_invoices(project_id)  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_sinv_updated_at ON supplier_invoices;
CREATE TRIGGER trg_sinv_updated_at BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Supplier payments (many per invoice, or on-account) ───────
CREATE TABLE IF NOT EXISTS supplier_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_id  UUID REFERENCES supplier_invoices(id) ON DELETE SET NULL,  -- optional: on-account payments allowed
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  currency    TEXT NOT NULL DEFAULT 'USD',    -- USD | TL | EUR
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_at     DATE,
  method      TEXT NOT NULL DEFAULT 'bank_transfer', -- bank_transfer | cash | check | other
  reference   TEXT,
  notes       TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_currency_check;
ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_currency_check CHECK (currency IN ('USD','TL','EUR'));
ALTER TABLE supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_method_check;
ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_method_check CHECK (method IN ('bank_transfer','cash','check','other'));

CREATE INDEX IF NOT EXISTS idx_spay_supplier ON supplier_payments(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spay_invoice  ON supplier_payments(invoice_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spay_project  ON supplier_payments(project_id)  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_spay_updated_at ON supplier_payments;
CREATE TRIGGER trg_spay_updated_at BEFORE UPDATE ON supplier_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
-- Vendor cost is sensitive: tlines_pm is deliberately EXCLUDED from every policy.
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_invoices_read ON supplier_invoices;
CREATE POLICY supplier_invoices_read ON supplier_invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting','trustlines_pm'))
  );
DROP POLICY IF EXISTS supplier_invoices_write ON supplier_invoices;
CREATE POLICY supplier_invoices_write ON supplier_invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting'))
  );

DROP POLICY IF EXISTS supplier_payments_read ON supplier_payments;
CREATE POLICY supplier_payments_read ON supplier_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting','trustlines_pm'))
  );
DROP POLICY IF EXISTS supplier_payments_write ON supplier_payments;
CREATE POLICY supplier_payments_write ON supplier_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting'))
  );
