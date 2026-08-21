-- 055_finalization.sql
-- Phase 3 — PM Finalization (PROJECT-MASTER-PLAN §4.4). After Closed Won, the T-Lines
-- PM turns the sold design into a real, buildable project: tracking customer change
-- requests and whether the site is physically ready.
--
--   change_requests  — a customer's requested change + the PM's feasibility decision.
--   site_readiness   — one row per project: a checklist of physical prerequisites.
--
-- Additive; RLS ENABLED (TEXT roles). These are project-scoped PM tools — no vendor
-- price / margin / PF surface, so they carry no tlines_pm secrecy concern.

-- ── CHANGE REQUESTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_contact_id UUID REFERENCES customer_contacts(id) ON DELETE SET NULL,  -- who asked
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT,                                -- scope | design | budget | timeline | material | other
  status              TEXT NOT NULL DEFAULT 'open',        -- open | under_review | approved | rejected | implemented | cancelled
  budget_impact       NUMERIC(15,2),                       -- delta vs current deal (PM-visible; not a vendor price)
  currency            TEXT,
  timeline_impact_days INTEGER,
  decision_note       TEXT,
  resolved_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_status_check;
ALTER TABLE change_requests ADD CONSTRAINT change_requests_status_check
  CHECK (status IN ('open', 'under_review', 'approved', 'rejected', 'implemented', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_cr_project ON change_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_cr_open    ON change_requests(project_id) WHERE deleted_at IS NULL AND status IN ('open', 'under_review');

DROP TRIGGER IF EXISTS trg_cr_updated_at ON change_requests;
CREATE TRIGGER trg_cr_updated_at BEFORE UPDATE ON change_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── SITE READINESS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_readiness (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  checklist         JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{key,label,done,done_at,done_by}]
  overall_status    TEXT NOT NULL DEFAULT 'not_ready',     -- not_ready | partial | ready
  target_ready_date DATE,
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_readiness DROP CONSTRAINT IF EXISTS site_readiness_status_check;
ALTER TABLE site_readiness ADD CONSTRAINT site_readiness_status_check
  CHECK (overall_status IN ('not_ready', 'partial', 'ready'));

CREATE INDEX IF NOT EXISTS idx_sr_project ON site_readiness(project_id);

DROP TRIGGER IF EXISTS trg_sr_updated_at ON site_readiness;
CREATE TRIGGER trg_sr_updated_at BEFORE UPDATE ON site_readiness FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS — project PM roles ────────────────────────────────────
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_readiness  ENABLE ROW LEVEL SECURITY;

-- Read for internal + PM roles; write for ops/gm + both PMs (they run finalization).
DROP POLICY IF EXISTS change_requests_read ON change_requests;
CREATE POLICY change_requests_read ON change_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','pm_millwork','pm_ceiling'))
  );

DROP POLICY IF EXISTS change_requests_write ON change_requests;
CREATE POLICY change_requests_write ON change_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  );

DROP POLICY IF EXISTS site_readiness_read ON site_readiness;
CREATE POLICY site_readiness_read ON site_readiness
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm','pm_millwork','pm_ceiling','logistics'))
  );

DROP POLICY IF EXISTS site_readiness_write ON site_readiness;
CREATE POLICY site_readiness_write ON site_readiness
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  );
