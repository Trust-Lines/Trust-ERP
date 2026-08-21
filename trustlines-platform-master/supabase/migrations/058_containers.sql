-- 058_containers.sql
-- Phase 7 — Containers & Logistics (PROJECT-MASTER-PLAN §11). A container is a central
-- record; production items are loaded into it and tracked from booking to warehouse.
--
--   containers       — one shipping container (booking → sailing → customs → warehouse).
--   container_items  — which production_items are loaded, with packing figures.
--
-- Additive; RLS ENABLED (TEXT role model). Financial data stays on production_items
-- (already tlines_pm-restricted); nothing sensitive is added here.

CREATE TABLE IF NOT EXISTS containers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_no            TEXT,
  booking_no              TEXT,
  carrier                 TEXT,
  vessel_name             TEXT,
  voyage_no               TEXT,
  origin_port             TEXT,
  destination_port        TEXT,
  departure_date          DATE,
  estimated_arrival_date  DATE,
  actual_arrival_date     DATE,
  customs_clearance_date  DATE,
  warehouse_arrival_date  DATE,
  status                  TEXT NOT NULL DEFAULT 'PLANNING',
  seal_no                 TEXT,
  tracking_url            TEXT,
  notes                   TEXT,
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE containers DROP CONSTRAINT IF EXISTS containers_status_check;
ALTER TABLE containers ADD CONSTRAINT containers_status_check
  CHECK (status IN (
    'PLANNING', 'BOOKED', 'WAITING_LOADING', 'LOADING', 'DEPARTED', 'IN_TRANSIT',
    'ARRIVED_PORT', 'CUSTOMS', 'RELEASED', 'WAREHOUSE', 'COMPLETED', 'CANCELLED'
  ));

CREATE INDEX IF NOT EXISTS idx_containers_status ON containers(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_containers_no ON containers(container_no);

DROP TRIGGER IF EXISTS trg_containers_updated_at ON containers;
CREATE TRIGGER trg_containers_updated_at BEFORE UPDATE ON containers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS container_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id       UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  production_item_id UUID NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  quantity           INTEGER,
  package_count      INTEGER,
  pallet_count       INTEGER,
  gross_weight       NUMERIC(12,2),
  volume_cbm         NUMERIC(12,3),
  loaded_at          TIMESTAMPTZ,
  unloaded_at        TIMESTAMPTZ,
  notes              TEXT,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One production item lives in at most one container at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_one_container ON container_items(production_item_id);
CREATE INDEX IF NOT EXISTS idx_ci_container ON container_items(container_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE containers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_items ENABLE ROW LEVEL SECURITY;

-- Read: internal operational roles. Write: logistics + ops/gm + Trust PM.
DROP POLICY IF EXISTS containers_read ON containers;
CREATE POLICY containers_read ON containers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm',
                           'logistics','accounting','qc_responsible','pm_millwork','pm_ceiling'))
  );

DROP POLICY IF EXISTS containers_write ON containers;
CREATE POLICY containers_write ON containers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','logistics'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','logistics'))
  );

DROP POLICY IF EXISTS container_items_read ON container_items;
CREATE POLICY container_items_read ON container_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm',
                           'logistics','accounting','qc_responsible','pm_millwork','pm_ceiling'))
  );

DROP POLICY IF EXISTS container_items_write ON container_items;
CREATE POLICY container_items_write ON container_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','logistics'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','logistics'))
  );
