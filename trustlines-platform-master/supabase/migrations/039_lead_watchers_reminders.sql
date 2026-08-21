-- 039_lead_watchers_reminders.sql
-- Watchers (follow a lead → get notified on changes) + a marker so follow-up
-- reminders are sent once per due date (no duplicate reminders).

CREATE TABLE IF NOT EXISTS lead_watchers (
  lead_intake_id UUID NOT NULL REFERENCES lead_intake(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_intake_id, user_id)
);

ALTER TABLE lead_watchers ENABLE ROW LEVEL SECURITY;

-- The watcher themselves, or the owning rep / any sales_marketing_manager.
-- (Dropped first so this migration is safe to re-run.)
DROP POLICY IF EXISTS lead_watchers_rw ON lead_watchers;
CREATE POLICY lead_watchers_rw ON lead_watchers
  FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM lead_intake li WHERE li.id = lead_intake_id
               AND (li.created_by = auth.uid()
                    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM lead_intake li WHERE li.id = lead_intake_id
               AND (li.created_by = auth.uid()
                    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager')))
  );

-- Set to the follow_up_date we already reminded the assignee about → send once.
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS follow_up_reminded_on DATE;

