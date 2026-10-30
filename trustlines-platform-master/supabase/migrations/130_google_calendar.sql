-- 130_google_calendar.sql (2026-10-28)
-- Each person connects their own Google account (Settings → Google account):
--   • their Google Calendar meetings show in the ERP ("My meetings"), and on the Contact /
--     Customer they were with (matched by attendee email);
--   • meetings created in the ERP go to their Google Calendar with a Google Meet link and an
--     invitation to the attendees;
--   • after a Meet call, its recording and transcript links (Workspace plans that record) are
--     attached to the meeting.
-- Everyone sees only their own calendar. Tokens are encrypted in the app (APP_ENCRYPTION_KEY).
-- New tables + two nullable columns on customer_meetings; no existing row is changed.

CREATE TABLE IF NOT EXISTS user_google_connections (
  user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  google_email      TEXT NOT NULL,
  access_token_enc  TEXT NOT NULL,
  refresh_token_enc TEXT,
  token_expires_at  TIMESTAMPTZ,
  scopes            TEXT[] NOT NULL DEFAULT '{}',
  last_sync_at      TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A copy of each person's Google Calendar events in the sync window (60 days back, 120 ahead).
CREATE TABLE IF NOT EXISTS google_calendar_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  google_event_id      TEXT NOT NULL,
  title                TEXT NOT NULL DEFAULT '(no title)',
  description          TEXT,
  location             TEXT,
  starts_at            TIMESTAMPTZ NOT NULL,
  ends_at              TIMESTAMPTZ,
  all_day              BOOLEAN NOT NULL DEFAULT FALSE,
  status               TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','tentative','cancelled')),
  organizer_email      TEXT,
  attendees            JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ email, name, response }]
  meet_url             TEXT,
  meet_code            TEXT,                                 -- e.g. abc-defg-hij (Meet API lookups)
  html_link            TEXT,
  google_updated_at    TIMESTAMPTZ,
  recording_url        TEXT,
  transcript_url       TEXT,
  recording_checked_at TIMESTAMPTZ,
  -- Who the meeting was with, matched from attendee emails (or set when created from the ERP).
  prospect_id          UUID REFERENCES prospects(id) ON DELETE SET NULL,
  customer_id          UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_meeting_id  UUID REFERENCES customer_meetings(id) ON DELETE SET NULL,
  created_in_erp       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_event_id)
);
CREATE INDEX IF NOT EXISTS idx_gcal_events_user_start ON google_calendar_events (user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_gcal_events_prospect ON google_calendar_events (prospect_id, starts_at DESC) WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gcal_events_customer ON google_calendar_events (customer_id, starts_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gcal_events_recording ON google_calendar_events (ends_at) WHERE meet_code IS NOT NULL AND recording_url IS NULL;

-- Customer 360 meetings created with a Google invite keep the link to the Google event.
ALTER TABLE customer_meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE customer_meetings ADD COLUMN IF NOT EXISTS meet_url TEXT;

DROP TRIGGER IF EXISTS trg_user_google_connections_updated_at ON user_google_connections;
CREATE TRIGGER trg_user_google_connections_updated_at BEFORE UPDATE ON user_google_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_google_calendar_events_updated_at ON google_calendar_events;
CREATE TRIGGER trg_google_calendar_events_updated_at BEFORE UPDATE ON google_calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS on, no policies: service-role routes with their own checks (117 pattern).
ALTER TABLE user_google_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;
