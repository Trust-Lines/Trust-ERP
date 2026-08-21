-- Migration 014: Production items (operational board source rows)
-- One row per project × type (Millwork/Shelving/Ceiling/Image…). Placeholder rows
-- are auto-seeded from a project's categories; PF codes are generated when a vendor
-- is assigned. Mirrors the source-of-truth model from the original Projects system.

-- Ensure the vendors table exists (some DBs never ran 001's suppliers table).
-- IF NOT EXISTS keeps the richer 001 definition intact where it already exists.
CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE,
  contact    JSONB,
  country    TEXT DEFAULT 'TR',
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- which board tab this row belongs to
  source          TEXT NOT NULL DEFAULT 'project'
                  CHECK (source IN ('project', 'direct_order', 'missing_extra')),
  type            TEXT NOT NULL,                    -- Millwork | Shelving | Ceiling | Image | Furniture | Decoration
  vendor_id       UUID REFERENCES suppliers(id),
  pf_code         TEXT,
  order_type      TEXT,                             -- e.g. 'STANDARD / BASIC', 'SELECTIVE / CUSTOM', 'FURNITURE'
  po_sign_status  TEXT NOT NULL DEFAULT 'NOT_SIGNED',
  pf_sign_status  TEXT NOT NULL DEFAULT 'NOT_SIGNED',
  status          TEXT NOT NULL DEFAULT 'NOT_ORDERED',
  std             DATE, etd DATE, rtd DATE, rtr DATE, rdy DATE, ftd DATE, snd DATE,
  pf_usd          NUMERIC(15,2) DEFAULT 0,
  pf_tl           NUMERIC(15,2) DEFAULT 0,
  invoice         NUMERIC(15,2) DEFAULT 0,
  invoice_tl      NUMERIC(15,2) DEFAULT 0,
  expenses_usd    NUMERIC(15,2) DEFAULT 0,
  expenses_tl     NUMERIC(15,2) DEFAULT 0,
  payment_rule    TEXT,
  container_no    TEXT,
  container_date  DATE,
  sort_index      INT DEFAULT 0,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_items_project
  ON production_items(project_id, source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_production_items_vendor
  ON production_items(vendor_id) WHERE deleted_at IS NULL;

-- RLS: authenticated users read; writes go through the service role (API routes).
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS production_items_select ON production_items;
CREATE POLICY production_items_select ON production_items
  FOR SELECT TO authenticated USING (true);

-- Realtime so the board + project page update live on any change.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE production_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed a handful of common vendors (no-op if codes already exist) ───────────
INSERT INTO suppliers (name, code, country) VALUES
  ('YAŞAMPLUS', 'YSM', 'TR'),
  ('GOSB',      'GOS', 'TR'),
  ('BARLOK',    'BARLOK', 'TR'),
  ('ACILED',    'ACI', 'TR'),
  ('DEMIR RAF', 'DMR', 'TR'),
  ('PIXEL PRINT', 'PIXEL', 'TR')
ON CONFLICT (code) DO NOTHING;
