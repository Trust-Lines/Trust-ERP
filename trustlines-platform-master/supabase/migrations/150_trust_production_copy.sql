-- 150_trust_production_copy.sql — room for a full copy of the Trust System Projects board
-- (Projects, Missing & Extra, Direct Orders) in T-ERP's own tables.
--
-- The copy itself is done by a script that only READS the Trust System (GET requests) and writes
-- here; nothing is ever written back to the Trust System. Every copied row keeps its Trust id
-- (trust_id / trust_project_id) so the copy can be run again without duplicates, and its full
-- Trust record (trust_raw) so no field is lost even where T-ERP has no column for it yet.
--
-- Additive only, no data is changed or removed here. Safe to run more than once.

-- ── projects: the Projects-board fields a project has in the Trust System ──────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS trust_project_id          TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_urgent                 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS half_of_year              TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS half_year                 INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS production_container_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS trust_raw                 JSONB;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_half_of_year_check;
ALTER TABLE projects ADD CONSTRAINT projects_half_of_year_check
  CHECK (half_of_year IS NULL OR half_of_year IN ('FIRST_HALF', 'SECOND_HALF'));

CREATE UNIQUE INDEX IF NOT EXISTS projects_trust_project_id_key
  ON projects (trust_project_id) WHERE trust_project_id IS NOT NULL;

-- ── production_cases: Direct Orders and Missing & Extra cases ───────────────────────────────
-- In the Trust System these are blocks of their own on the board: a Direct Order ("DO-01") is
-- not tied to a customer project, and a Missing & Extra case ("344-EX-1") points at its base
-- project only by number and name for most older cases.
CREATE TABLE IF NOT EXISTS production_cases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              TEXT NOT NULL CHECK (kind IN ('direct_order', 'missing_extra')),
  code              TEXT NOT NULL,                 -- "DO-01", "344-EX-1"
  name              TEXT,
  address           TEXT,
  bucket            TEXT CHECK (bucket IS NULL OR bucket IN ('TLINES_NE','TLINES_SE','TLINES_NW','CVW','TLINES_HQ','TLINES_TC')),
  case_type         TEXT CHECK (case_type IS NULL OR case_type IN ('MISSING', 'EXTRA', 'REPLACEMENT')),
  case_index        INTEGER,
  base_project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  base_project_no   TEXT,
  base_project_name TEXT,
  types             TEXT[] NOT NULL DEFAULT '{}',
  is_urgent         BOOLEAN NOT NULL DEFAULT false,
  half_of_year      TEXT CHECK (half_of_year IS NULL OR half_of_year IN ('FIRST_HALF', 'SECOND_HALF')),
  half_year         INTEGER,
  container_date    DATE,
  trust_id          TEXT,
  trust_raw         JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS production_cases_trust_id_key ON production_cases (trust_id) WHERE trust_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS production_cases_kind_idx ON production_cases (kind) WHERE deleted_at IS NULL;

-- Same rule as production_items (080): Trust-internal; tlines_pm never reads it. The app reads
-- and writes through the service-role API routes.
ALTER TABLE production_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS production_cases_select ON production_cases;
CREATE POLICY production_cases_select ON production_cases
  FOR SELECT TO authenticated USING (
    NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'tlines_pm')
  );

-- ── production_items: case rows, and every Trust field ─────────────────────────────────────
-- A Direct Order row has no customer project, and an older Missing & Extra row may not either;
-- every row still belongs to a project or a case.
ALTER TABLE production_items ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES production_cases(id) ON DELETE CASCADE;
ALTER TABLE production_items DROP CONSTRAINT IF EXISTS production_items_owner_check;
ALTER TABLE production_items ADD CONSTRAINT production_items_owner_check
  CHECK (project_id IS NOT NULL OR case_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS production_items_case_idx ON production_items (case_id) WHERE case_id IS NOT NULL;

ALTER TABLE production_items ADD COLUMN IF NOT EXISTS trust_id               TEXT;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS custom_type_code       TEXT;   -- custom types: the type's code; type = its name
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS status_note            TEXT;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS price_notes            JSONB;  -- { "pfUsd": "…", "invoice": "…" }
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS paid_usd1              NUMERIC(15,2);
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS paid_usd2              NUMERIC(15,2);
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS paid_tl1               NUMERIC(15,2);
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS paid_tl2               NUMERIC(15,2);
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS paid_usd1_date         DATE;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS paid_usd2_date         DATE;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS paid_tl1_date          DATE;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS paid_tl2_date          DATE;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS invoice_number         TEXT;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS invoice_transaction_no TEXT;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS invoice_date           DATE;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS quick_book             TEXT;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS due_paid               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS description            TEXT;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS price_list_code        TEXT;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS trust_raw              JSONB;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS trust_synced_at        TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS production_items_trust_id_key ON production_items (trust_id) WHERE trust_id IS NOT NULL;

-- 148's "one auto-seeded placeholder per project and type" applies to the rows T-ERP seeds
-- itself. Copied Trust rows can legitimately have two vendor-less rows of one type.
DROP INDEX IF EXISTS production_items_one_seed_per_type;
CREATE UNIQUE INDEX IF NOT EXISTS production_items_one_seed_per_type
  ON production_items (project_id, type)
  WHERE source = 'project' AND vendor_id IS NULL AND deleted_at IS NULL AND trust_id IS NULL;
