-- Dropbox change feed state for the automatic document sync (lib/dropbox/autoSync.ts):
-- the list_folder cursor of /D-Projects and a short lock so the webhook and the cron never
-- process the same changes twice. Service role only (RLS on, no policies).
CREATE TABLE IF NOT EXISTS dropbox_sync_state (
  id           TEXT PRIMARY KEY,
  cursor       TEXT,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE dropbox_sync_state ENABLE ROW LEVEL SECURITY;
INSERT INTO dropbox_sync_state (id) VALUES ('changes') ON CONFLICT (id) DO NOTHING;
