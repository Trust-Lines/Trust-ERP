-- 126_schema_drift_fix.sql (2026-10-27)
-- QA Task 4 Day 2 — DEF-02 / DEF-03 / DEF-04 / DEF-05.
-- These columns/tables are used by app code but no migration ever created them
-- (they were most likely added by hand on production). A fresh database built from
-- migrations — e.g. the TEST DB — therefore breaks Clients, Documents/Approvals,
-- PF/PO/PDF generation and the Item List catalog.
--
-- Everything is IF NOT EXISTS, so on a database that already has these objects
-- (production) this migration is a no-op and touches no data.
--
-- BEFORE APPLYING ANYWHERE: compare the definitions below with production's real
-- schema (information_schema / `supabase db diff`) and adjust types if they differ.
-- Known wider drift NOT fixed here: client_franchises and client_companies are only
-- ALTERed by migrations 017/022, never created — hence no FK on client_franchise_id.

-- DEF-02: Clients page reads and writes clients.notes.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;

-- DEF-03: Dropbox-side version number of a document (falls back to documents.version in code).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS dropbox_version INTEGER;

-- DEF-04: franchise of the client, used in PF/PO/signed PDF client names.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_franchise_id UUID;

-- DEF-05: reusable Item List lines (app/api/catalog-items).
CREATE TABLE IF NOT EXISTS catalog_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code         TEXT,
  description       TEXT NOT NULL,
  description_note  TEXT,
  category          TEXT,
  unit_price        NUMERIC(14,2),
  taking            TEXT,
  vendor            TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The POST route upserts ON CONFLICT (description, category). Production already has a
-- unique index/constraint on these columns under its own name, so only create one when
-- no unique index covers exactly (description, category).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'catalog_items'::regclass
      AND i.indisunique
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM pg_attribute a
           WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey))
          = ARRAY['category', 'description']
  ) THEN
    CREATE UNIQUE INDEX uq_catalog_items_description_category
      ON catalog_items (description, category);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_catalog_items_item_code ON catalog_items (item_code);

-- RLS: only reached through the service-role client in app/api/catalog-items, which does
-- its own auth check — enable RLS with no policies so a stray anon/RLS query gets nothing.
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
