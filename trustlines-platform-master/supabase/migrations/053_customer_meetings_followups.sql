-- 053_customer_meetings_followups.sql
-- Phase 2/3 — customer communication tracking (PROJECT-MASTER-PLAN §4.4).
--
--   customer_meetings    — meetings held with an end customer.
--   customer_follow_ups  — the "call them back on X" queue.
--
-- Both hang off `customers` and may ALSO point at the originating lead and/or the
-- resulting project, so the same record survives Lead → Closed Won → Project without
-- being duplicated (single Project ID principle). Additive; RLS ENABLED (TEXT roles).

-- ── CUSTOMER MEETINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_meetings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_intake_id UUID REFERENCES lead_intake(id) ON DELETE SET NULL,
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  meeting_type   TEXT,                                -- discovery | site_visit | presentation | handover | other
  meeting_at     TIMESTAMPTZ NOT NULL,
  location       TEXT,
  attendees      TEXT,                                -- free text; structured contacts live in customer_contacts
  notes          TEXT,
  outcome        TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled',   -- scheduled | completed | cancelled
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customer_meetings DROP CONSTRAINT IF EXISTS customer_meetings_status_check;
ALTER TABLE customer_meetings ADD CONSTRAINT customer_meetings_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_cm_customer ON customer_meetings(customer_id);
CREATE INDEX IF NOT EXISTS idx_cm_lead     ON customer_meetings(lead_intake_id);
CREATE INDEX IF NOT EXISTS idx_cm_project  ON customer_meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_cm_upcoming ON customer_meetings(meeting_at) WHERE deleted_at IS NULL AND status = 'scheduled';

DROP TRIGGER IF EXISTS trg_cm_updated_at ON customer_meetings;
CREATE TRIGGER trg_cm_updated_at BEFORE UPDATE ON customer_meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── CUSTOMER FOLLOW-UPS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_follow_ups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_intake_id UUID REFERENCES lead_intake(id) ON DELETE SET NULL,
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
  note           TEXT NOT NULL,
  due_date       DATE NOT NULL,
  assignee_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'open',        -- open | done | cancelled
  completed_at   TIMESTAMPTZ,
  completed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customer_follow_ups DROP CONSTRAINT IF EXISTS customer_follow_ups_status_check;
ALTER TABLE customer_follow_ups ADD CONSTRAINT customer_follow_ups_status_check
  CHECK (status IN ('open', 'done', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_cfu_customer ON customer_follow_ups(customer_id);
CREATE INDEX IF NOT EXISTS idx_cfu_assignee ON customer_follow_ups(assignee_id);
CREATE INDEX IF NOT EXISTS idx_cfu_project  ON customer_follow_ups(project_id);
-- The hot query: "what is still open and due?"
CREATE INDEX IF NOT EXISTS idx_cfu_due_open ON customer_follow_ups(due_date) WHERE deleted_at IS NULL AND status = 'open';

DROP TRIGGER IF EXISTS trg_cfu_updated_at ON customer_follow_ups;
CREATE TRIGGER trg_cfu_updated_at BEFORE UPDATE ON customer_follow_ups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS — same visibility as `customers` (045) ────────────────
ALTER TABLE customer_meetings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_meetings_read ON customer_meetings;
CREATE POLICY customer_meetings_read ON customer_meetings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep',
                           'sales_marketing_manager','tlines_pm','trustlines_pm'))
  );

DROP POLICY IF EXISTS customer_meetings_write ON customer_meetings;
CREATE POLICY customer_meetings_write ON customer_meetings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager','tlines_pm'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager','tlines_pm'))
  );

DROP POLICY IF EXISTS customer_follow_ups_read ON customer_follow_ups;
CREATE POLICY customer_follow_ups_read ON customer_follow_ups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep',
                           'sales_marketing_manager','tlines_pm','trustlines_pm'))
  );

DROP POLICY IF EXISTS customer_follow_ups_write ON customer_follow_ups;
CREATE POLICY customer_follow_ups_write ON customer_follow_ups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager','tlines_pm'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','sales_rep','sales_marketing_manager','tlines_pm'))
  );
