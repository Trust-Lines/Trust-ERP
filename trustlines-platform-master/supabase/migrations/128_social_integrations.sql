-- 128_social_integrations.sql (2026-10-27)
-- Connects the Social Media page (127) to the platforms themselves: Meta (Instagram + Facebook
-- Pages), Google (YouTube) and LinkedIn (company pages). Follower counts and post results are
-- synced automatically, and posts written in the ERP are published to Instagram / Facebook /
-- LinkedIn when their time comes. Manual entry keeps working for accounts that aren't connected.
--
-- Adds columns and one table; no existing row is changed. Tokens are stored encrypted
-- (AES-256-GCM, key in the SOCIAL_TOKEN_KEY env var — never in the database).

-- One row per platform login ("Connect Instagram" done by a manager).
CREATE TABLE IF NOT EXISTS social_connections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           TEXT NOT NULL CHECK (provider IN ('meta','google','linkedin')),
  external_user_id   TEXT,
  external_user_name TEXT,
  access_token_enc   TEXT NOT NULL,
  refresh_token_enc  TEXT,
  token_expires_at   TIMESTAMPTZ,
  scopes             TEXT[] NOT NULL DEFAULT '{}',
  connected_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_error         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at         TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_social_connections_updated_at ON social_connections;
CREATE TRIGGER trg_social_connections_updated_at
  BEFORE UPDATE ON social_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

-- Accounts found through a connection (Facebook Page, its Instagram Business account,
-- YouTube channel, LinkedIn organization). external_token_enc = the account's own token
-- where the platform has one (Facebook Page token, used for Instagram as well).
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS connection_id      UUID REFERENCES social_connections(id) ON DELETE SET NULL;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS external_id        TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS external_token_enc TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS avatar_url         TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS last_synced_at     TIMESTAMPTZ;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS sync_error         TEXT;
-- NULLs never collide, so manual accounts (no external_id) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_accounts_external ON social_accounts (platform, external_id);

-- Posts: where they came from, the media to publish, the exact publish time, and the result.
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','synced','erp'));
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS external_id   TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_url     TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_type    TEXT CHECK (media_type IN ('image','video','text'));
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS scheduled_at  TIMESTAMPTZ;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS publish_error TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_posts_external ON social_posts (account_id, external_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_due ON social_posts (scheduled_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL AND scheduled_at IS NOT NULL;

-- New status for an automatic publish the platform refused (the error is in publish_error).
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status IN ('idea','draft','scheduled','publishing','published','failed','cancelled'));
