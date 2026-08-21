-- 061_trust_expenses.sql
-- Phase 9 — Trust Expenses (PROJECT-MASTER-PLAN §Phase 9). A general ledger of
-- Trust Lines' own operational spend (customs, logistics, office, travel, salary,
-- rent, utilities, marketing…), optionally tagged to a project and/or supplier.
-- Distinct from `production_items.expenses_*` (per-order extra cost) and from
-- `supplier_invoices/payments` (what we owe a specific vendor).
--
-- SECURITY: internal cost — `tlines_pm` (client-side PM) must NEVER see it.
-- Read = ops/gm/accountant/accounting/trustlines_pm.  Write = ops/gm/accountant/accounting.
-- Additive & re-runnable; RLS ENABLED (TEXT roles, EXISTS-on-profiles idiom).

CREATE TABLE IF NOT EXISTS trust_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL DEFAULT 'other',   -- see EXPENSE_CATEGORIES in lib/expenses/config.ts
  description  TEXT,
  currency     TEXT NOT NULL DEFAULT 'USD',     -- USD | TL | EUR
  amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  expense_date DATE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,   -- optional tag
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,  -- optional tag
  is_paid      BOOLEAN NOT NULL DEFAULT FALSE,
  dropbox_path TEXT,                             -- linked receipt (never deleted/overwritten)
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trust_expenses DROP CONSTRAINT IF EXISTS trust_expenses_currency_check;
ALTER TABLE trust_expenses ADD CONSTRAINT trust_expenses_currency_check CHECK (currency IN ('USD','TL','EUR'));

CREATE INDEX IF NOT EXISTS idx_texp_date     ON trust_expenses(expense_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_texp_project  ON trust_expenses(project_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_texp_supplier ON trust_expenses(supplier_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_texp_category ON trust_expenses(category)      WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_texp_updated_at ON trust_expenses;
CREATE TRIGGER trg_texp_updated_at BEFORE UPDATE ON trust_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE trust_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trust_expenses_read ON trust_expenses;
CREATE POLICY trust_expenses_read ON trust_expenses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting','trustlines_pm'))
  );
DROP POLICY IF EXISTS trust_expenses_write ON trust_expenses;
CREATE POLICY trust_expenses_write ON trust_expenses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','accountant','accounting'))
  );
