-- 117_mail_templates.sql (2026-09-24)
-- Marketing mail templates for the Contacts query-builder's bulk-download/bulk-send workflow
-- (2026-09-23/24 decisions: Contacts is query-first now, results feed a template instead of a
-- free-browsed list). body_html supports {{token}} placeholders resolved against a prospect
-- row — see lib/marketing/mailTemplates.ts MERGE_FIELDS for the exact supported set.

CREATE TABLE IF NOT EXISTS mail_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mail_templates_active ON mail_templates (created_at DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_mail_templates_updated_at ON mail_templates;
CREATE TRIGGER trg_mail_templates_updated_at
  BEFORE UPDATE ON mail_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: every route that reads/writes this table uses the admin (service-role) client and does
-- its own role check (MARKETING_WRITE_ROLES) in app code, same pattern as marketing_campaigns
-- — enable RLS with no policies so a stray client-side (anon/RLS) query gets nothing, not the
-- whole table.
ALTER TABLE mail_templates ENABLE ROW LEVEL SECURITY;
