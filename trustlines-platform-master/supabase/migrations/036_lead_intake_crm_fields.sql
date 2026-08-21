-- 036_lead_intake_crm_fields.sql
-- Real CRM fields for a lead (previously placeholders in the Leads board):
-- priority, assignee (owner rep), deal size, source, follow-up date, next action,
-- tags. Editable on the intake form; shown on the Leads board.

ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE lead_intake DROP CONSTRAINT IF EXISTS lead_intake_priority_check;
ALTER TABLE lead_intake ADD CONSTRAINT lead_intake_priority_check
  CHECK (priority IN ('high','medium','low'));

ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS assignee_id    UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS deal_size      NUMERIC(15,2);
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS source         TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS next_action    TEXT;
ALTER TABLE lead_intake ADD COLUMN IF NOT EXISTS tags           TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_lead_intake_assignee ON lead_intake(assignee_id) WHERE assignee_id IS NOT NULL;
