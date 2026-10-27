-- 127_pr_workspace.sql (2026-10-27)
-- Marketing & PR workspace: social media tracking (accounts, follower history, posts with
-- their results) and a shared team calendar the PR team writes on.
-- New tables only — no existing table or row is touched.
--
-- Metrics are entered by hand (no platform API connection yet): the team copies follower
-- counts and post results from Instagram / LinkedIn / … into the ERP.

-- Accounts the team runs (one row per platform handle).
CREATE TABLE IF NOT EXISTS social_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       TEXT NOT NULL CHECK (platform IN ('instagram','facebook','linkedin','x','youtube','tiktok','other')),
  handle         TEXT NOT NULL,
  profile_url    TEXT,
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_accounts_platform_handle
  ON social_accounts (platform, lower(handle)) WHERE deleted_at IS NULL;

-- Follower count per account per day — the growth history behind the KPI cards.
CREATE TABLE IF NOT EXISTS social_account_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  recorded_on  DATE NOT NULL,
  followers    INTEGER NOT NULL CHECK (followers >= 0),
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, recorded_on)
);
CREATE INDEX IF NOT EXISTS idx_social_account_stats_account ON social_account_stats (account_id, recorded_on DESC);

-- Posts: planned (idea → draft → scheduled) and published, with the results once known.
CREATE TABLE IF NOT EXISTS social_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  caption       TEXT,
  status        TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','draft','scheduled','published','cancelled')),
  planned_on    DATE,
  published_on  DATE,
  post_url      TEXT,
  campaign_id   UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  impressions   INTEGER CHECK (impressions >= 0),
  reach         INTEGER CHECK (reach >= 0),
  likes         INTEGER CHECK (likes >= 0),
  comments      INTEGER CHECK (comments >= 0),
  shares        INTEGER CHECK (shares >= 0),
  saves         INTEGER CHECK (saves >= 0),
  clicks        INTEGER CHECK (clicks >= 0),
  notes         TEXT,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_social_posts_planned ON social_posts (planned_on) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_published ON social_posts (published_on) WHERE deleted_at IS NULL;

-- Team calendar: events, press, meetings, deadlines — anything the PR team plans by date.
CREATE TABLE IF NOT EXISTS marketing_calendar_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('event','press','meeting','deadline','content','other')),
  starts_on    DATE NOT NULL,
  ends_on      DATE,
  start_time   TIME,
  end_time     TIME,
  location     TEXT,
  notes        TEXT,
  campaign_id  UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_marketing_calendar_range
  ON marketing_calendar_entries (starts_on, ends_on) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER trg_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_social_posts_updated_at ON social_posts;
CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON social_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_marketing_calendar_updated_at ON marketing_calendar_entries;
CREATE TRIGGER trg_marketing_calendar_updated_at
  BEFORE UPDATE ON marketing_calendar_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: same pattern as mail_templates (117) — every route uses the service-role client and does
-- its own role check (MARKETING_READ_ROLES / MARKETING_WRITE_ROLES), so enable RLS with no
-- policies: a stray anon/RLS query gets nothing.
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_account_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_calendar_entries ENABLE ROW LEVEL SECURITY;
