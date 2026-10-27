-- 129_email_marketing.sql (2026-10-27)
-- Email from the ERP with each person's own mailbox:
--   • user_mail_settings — everyone's own SMTP login (password encrypted in the app with
--     APP_ENCRYPTION_KEY, never stored in clear), sender name, signature, daily limit.
--   • email_campaigns — Mailchimp-style campaigns: audience = a saved Contacts query,
--     content, sender, schedule.
--   • email_messages — every email sent (campaign, one-to-one, test) with its delivery,
--     open and click state; email_events — each open / click / unsubscribe.
--   • email_suppressions — addresses that must never be emailed again (unsubscribed, bounced).
-- New tables only; no existing row is changed.

CREATE TABLE IF NOT EXISTS user_mail_settings (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  from_name      TEXT NOT NULL,
  from_email     TEXT NOT NULL,
  reply_to       TEXT,
  smtp_host      TEXT NOT NULL,
  smtp_port      INTEGER NOT NULL CHECK (smtp_port BETWEEN 1 AND 65535),
  smtp_secure    BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = TLS from the start (465); FALSE = STARTTLS (587)
  smtp_user      TEXT NOT NULL,
  smtp_pass_enc  TEXT NOT NULL,
  signature_html TEXT,
  daily_limit    INTEGER NOT NULL DEFAULT 400 CHECK (daily_limit BETWEEN 1 AND 10000),
  verified_at    TIMESTAMPTZ,
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  subject         TEXT NOT NULL DEFAULT '',
  preheader       TEXT,
  body_html       TEXT NOT NULL DEFAULT '',
  template_id     UUID REFERENCES mail_templates(id) ON DELETE SET NULL,
  sender_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  audience        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- Contacts query (lib/marketing/prospectQuery.ts params)
  marketing_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','paused','sent','cancelled')),
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,                   -- why sending paused (e.g. the sender removed their SMTP settings)
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_due ON email_campaigns (scheduled_at) WHERE status = 'scheduled' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS email_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('campaign','direct','test')),
  campaign_id     UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  prospect_id     UUID REFERENCES prospects(id) ON DELETE SET NULL,
  sender_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_email        TEXT NOT NULL,
  to_name         TEXT,
  subject         TEXT NOT NULL,
  body_html       TEXT,                  -- kept for one-to-one emails (the history shows what was sent)
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed','skipped')),
  error           TEXT,
  smtp_message_id TEXT,
  token           TEXT NOT NULL UNIQUE,  -- random, in the open/click/unsubscribe links
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  open_count      INTEGER NOT NULL DEFAULT 0,
  clicked_at      TIMESTAMPTZ,
  click_count     INTEGER NOT NULL DEFAULT 0,
  unsubscribed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One email per address per campaign, however the audience query overlaps.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_messages_campaign_to ON email_messages (campaign_id, lower(to_email)) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_queue ON email_messages (sender_user_id, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_email_messages_prospect ON email_messages (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_sent ON email_messages (sender_user_id, sent_at);

CREATE TABLE IF NOT EXISTS email_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('open','click','unsubscribe')),
  url         TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_events_message ON email_events (message_id, created_at);

CREATE TABLE IF NOT EXISTS email_suppressions (
  email        TEXT PRIMARY KEY,          -- always stored lower-case
  reason       TEXT NOT NULL CHECK (reason IN ('unsubscribed','bounced','complaint','manual')),
  campaign_id  UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  note         TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email = lower(email))
);

DROP TRIGGER IF EXISTS trg_user_mail_settings_updated_at ON user_mail_settings;
CREATE TRIGGER trg_user_mail_settings_updated_at BEFORE UPDATE ON user_mail_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER trg_email_campaigns_updated_at BEFORE UPDATE ON email_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_email_messages_updated_at ON email_messages;
CREATE TRIGGER trg_email_messages_updated_at BEFORE UPDATE ON email_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS on, no policies: every route uses the service-role client with its own checks (117 pattern).
ALTER TABLE user_mail_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;

-- Per-campaign totals for the list and the report, computed in the database. security_invoker:
-- the view runs with the caller's rights, so the RLS on email_messages still applies (anon
-- and logged-in clients get nothing; the service role reads it).
CREATE OR REPLACE VIEW email_campaign_stats WITH (security_invoker = true) AS
SELECT
  campaign_id,
  count(*)                                              AS total,
  count(*) FILTER (WHERE status IN ('queued','sending')) AS pending,
  count(*) FILTER (WHERE status = 'sent')               AS sent,
  count(*) FILTER (WHERE status = 'failed')             AS failed,
  count(*) FILTER (WHERE status = 'skipped')            AS skipped,
  count(opened_at)                                      AS opened,
  count(clicked_at)                                     AS clicked,
  count(unsubscribed_at)                                AS unsubscribed,
  coalesce(sum(open_count), 0)                          AS opens,
  coalesce(sum(click_count), 0)                         AS clicks
FROM email_messages
WHERE campaign_id IS NOT NULL
GROUP BY campaign_id;
