-- 059_delivery_build.sql
-- Phase 8 — Delivery & Build (PROJECT-MASTER-PLAN §4.8). After production the project
-- is delivered (warehouse / direct job site / partial), built/installed, punch-listed,
-- accepted by the customer, and completed.
--
--   delivery_plans    — one per project: where/how it's delivered + build + acceptance.
--   punch_list_items  — the fix-it list captured at handover/build.
--
-- (The full Missing & Extra workflow is Phase 9.) Additive; RLS ENABLED (TEXT roles).

CREATE TABLE IF NOT EXISTS delivery_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  delivery_method   TEXT NOT NULL DEFAULT 'warehouse',   -- warehouse | direct_job_site | partial | hold
  installation_date DATE,
  build_by          TEXT,                                -- trust_build | customer | other
  build_schedule    TEXT,
  site_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
  customer_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_by       TEXT,                                -- the customer contact who accepted
  accepted_at       TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'planning',    -- planning | scheduled | in_progress | completed
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE delivery_plans DROP CONSTRAINT IF EXISTS delivery_plans_method_check;
ALTER TABLE delivery_plans ADD CONSTRAINT delivery_plans_method_check
  CHECK (delivery_method IN ('warehouse', 'direct_job_site', 'partial', 'hold'));
ALTER TABLE delivery_plans DROP CONSTRAINT IF EXISTS delivery_plans_status_check;
ALTER TABLE delivery_plans ADD CONSTRAINT delivery_plans_status_check
  CHECK (status IN ('planning', 'scheduled', 'in_progress', 'completed'));

CREATE INDEX IF NOT EXISTS idx_dp_project ON delivery_plans(project_id);

DROP TRIGGER IF EXISTS trg_dp_updated_at ON delivery_plans;
CREATE TRIGGER trg_dp_updated_at BEFORE UPDATE ON delivery_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS punch_list_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'open',   -- open | done
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE punch_list_items DROP CONSTRAINT IF EXISTS punch_list_items_status_check;
ALTER TABLE punch_list_items ADD CONSTRAINT punch_list_items_status_check CHECK (status IN ('open', 'done'));

CREATE INDEX IF NOT EXISTS idx_pli_project ON punch_list_items(project_id);
CREATE INDEX IF NOT EXISTS idx_pli_open ON punch_list_items(project_id) WHERE deleted_at IS NULL AND status = 'open';

DROP TRIGGER IF EXISTS trg_pli_updated_at ON punch_list_items;
CREATE TRIGGER trg_pli_updated_at BEFORE UPDATE ON punch_list_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE delivery_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_list_items ENABLE ROW LEVEL SECURITY;

-- Read: internal PM/ops/logistics/qc. Write: ops/gm + both PMs + logistics.
DROP POLICY IF EXISTS delivery_plans_read ON delivery_plans;
CREATE POLICY delivery_plans_read ON delivery_plans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','logistics','qc_responsible','pm_millwork','pm_ceiling'))
  );
DROP POLICY IF EXISTS delivery_plans_write ON delivery_plans;
CREATE POLICY delivery_plans_write ON delivery_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','logistics'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','logistics'))
  );

DROP POLICY IF EXISTS punch_list_read ON punch_list_items;
CREATE POLICY punch_list_read ON punch_list_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','logistics','qc_responsible','pm_millwork','pm_ceiling'))
  );
DROP POLICY IF EXISTS punch_list_write ON punch_list_items;
CREATE POLICY punch_list_write ON punch_list_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','logistics','qc_responsible'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','logistics','qc_responsible'))
  );
