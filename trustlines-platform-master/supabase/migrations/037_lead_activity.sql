-- 037_lead_activity.sql
-- Per-lead activity feed + comments (the ClickUp-style history). Two kinds:
--   'change'  — auto-logged when a field changes (status, priority, assignee…)
--   'comment' — a note typed by a sales user
--
-- Same Sales-only RLS boundary as lead_intake (029): the owning sales_rep and any
-- sales_marketing_manager. All access is also via role-gated admin API routes.

CREATE TABLE IF NOT EXISTS lead_activity (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_intake_id UUID NOT NULL REFERENCES lead_intake(id) ON DELETE CASCADE,
  actor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL DEFAULT 'comment',
  body           TEXT,
  meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_activity_kind_check CHECK (kind IN ('comment','change'))
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity(lead_intake_id, created_at DESC);

ALTER TABLE lead_activity ENABLE ROW LEVEL SECURITY;

-- (Dropped first so this migration is safe to re-run.)
DROP POLICY IF EXISTS lead_activity_sales_rw ON lead_activity;
CREATE POLICY lead_activity_sales_rw ON lead_activity
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lead_intake li
      WHERE li.id = lead_intake_id
        AND (li.created_by = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_intake li
      WHERE li.id = lead_intake_id
        AND (li.created_by = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager'))
    )
  );
