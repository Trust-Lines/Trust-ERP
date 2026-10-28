-- 131_sales_estimates_contracts.sql (2026-10-28)
-- The two Sales steps of the system drawing that had no home: Estimate (after Design) and
-- Contract (before Closed Deal). Both belong to an Opportunity.
--   • sales_estimates  — priced line items, versioned; sent to the customer by a secure link
--     (/quote/<token>) where they accept or reject it.
--   • sales_contracts  — made from an accepted estimate; the customer signs it on
--     /contract/<token> (typed name + consent, with time / IP / user agent recorded).
-- Only sha256(token) is stored (same pattern as approval_links, 056). New tables only.

CREATE TABLE IF NOT EXISTS sales_estimates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  number          TEXT NOT NULL UNIQUE,              -- EST-YYYYMM-XXXXXX
  version         INTEGER NOT NULL DEFAULT 1,
  title           TEXT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','TRY','GBP')),
  line_items      JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ description, quantity, unit, unit_price }]
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  tax_pct         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_pct BETWEEN 0 AND 100),
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes           TEXT,                               -- shown to the customer
  valid_until     DATE,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired','superseded')),
  token_hash      TEXT UNIQUE,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  decided_by_name TEXT,
  decision_note   TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sales_estimates_opp ON sales_estimates (opportunity_id, version DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sales_contracts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id   UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  estimate_id      UUID REFERENCES sales_estimates(id) ON DELETE SET NULL,
  number           TEXT NOT NULL UNIQUE,             -- CTR-YYYYMM-XXXXXX
  title            TEXT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD',
  amount           NUMERIC(14,2) NOT NULL DEFAULT 0,
  terms            TEXT NOT NULL,                     -- the full text the customer signs
  customer_name    TEXT,                              -- company the contract is with
  signer_name      TEXT,                              -- expected signer (pre-filled on the page)
  signer_email     TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','declined','cancelled')),
  content_hash     TEXT,                              -- sha256 of what was sent — the signed text can't change
  token_hash       TEXT UNIQUE,
  sent_at          TIMESTAMPTZ,
  viewed_at        TIMESTAMPTZ,
  signed_at        TIMESTAMPTZ,
  signed_name      TEXT,
  signed_title     TEXT,
  signed_ip        TEXT,
  signed_user_agent TEXT,
  declined_reason  TEXT,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sales_contracts_opp ON sales_contracts (opportunity_id, created_at DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_sales_estimates_updated_at ON sales_estimates;
CREATE TRIGGER trg_sales_estimates_updated_at BEFORE UPDATE ON sales_estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_sales_contracts_updated_at ON sales_contracts;
CREATE TRIGGER trg_sales_contracts_updated_at BEFORE UPDATE ON sales_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS on, no policies: service-role routes with their own checks (117 pattern).
ALTER TABLE sales_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_contracts ENABLE ROW LEVEL SECURITY;
