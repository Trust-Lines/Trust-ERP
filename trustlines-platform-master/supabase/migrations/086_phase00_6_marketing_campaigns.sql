-- 086_phase00_6_marketing_campaigns.sql — PHASE 00.6 Marketing Campaigns & Public Survey
--
-- Closes the gap PROJECT-MASTER-PLAN.md has flagged since migration 072: "Phase 00.6
-- Sources/Campaigns/Events attribution — still no table; source_label free-text is the
-- only attribution today." `prospects.campaign_id` has existed as an unpointed placeholder
-- FK since 072 ("FK lands with marketing_campaigns (Phase 00.6)") — this migration is
-- that FK finally landing. No second Prospect/Lead system is created: campaigns attach to
-- the EXISTING prospects/prospect_needs rows, reuse the existing classification engine
-- (lib/marketing/opportunityEngine.ts's runClassificationForNeed(), untouched), and the
-- existing role/RLS/audit conventions (migrations 070/072/084).
--
-- WHY a real "first-touch vs last-touch" pair, not just source_label:
-- source_label today is a single free-text field, overwritten in place — there is no
-- record of where a Lead ORIGINALLY came from once it's touched by a second campaign. The
-- product requirement (CRM Faz — Marketing Campaign & Public Survey backend) is explicit:
-- Original Source must never change after first set; Latest Source/Latest Campaign track
-- the most recent touch. `prospects.source_label` already behaves as "set once at
-- creation, never overwritten" in every existing code path (app/api/marketing/prospects/
-- route.ts never updates it) — so it is kept AS the original-source field rather than
-- inventing a duplicate `original_source_label` column. Only the two NEW "latest" columns
-- are added below.
--
-- Role model (CLAUDE.md / AGENTS.md): profiles.role is TEXT, no user_role enum. RLS below
-- is defense-in-depth only — the real gate is requireRole() in the API layer (service-role
-- client bypasses RLS). Public submission endpoints (app/api/public/campaigns/**) use the
-- SAME service-role admin client and are gated by campaign.status + rate limiting in the
-- route/service layer, never by RLS (mirrors the existing /api/public/reviews/[token]
-- pattern in lib/approvals/publicReview.ts, which also runs entirely through the
-- service-role client with no anon Supabase key involved).

-- ── MARKETING CAMPAIGNS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  code                  TEXT,
  slug                  TEXT NOT NULL,   -- backend-generated, immutable once created (see lib/marketing/campaignSlug.ts)
  campaign_type         TEXT NOT NULL,
  source                TEXT NOT NULL,   -- one of lib/marketing/classification.ts's SOURCES (LeadSource) — reused, not reinvented
  city                  TEXT,
  country               TEXT,
  venue                 TEXT,
  description           TEXT,
  start_date            DATE,
  end_date              DATE,
  default_language      TEXT NOT NULL DEFAULT 'en',
  owner_user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'draft',
  public_title          TEXT,
  public_description    TEXT,
  consent_text_version  TEXT NOT NULL DEFAULT 'v1',
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at             TIMESTAMPTZ,
  deleted_at            TIMESTAMPTZ    -- soft-delete only (never hard-delete a campaign with submissions — see B/I of the spec)
);

ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_type_check;
ALTER TABLE marketing_campaigns ADD  CONSTRAINT marketing_campaigns_type_check
  CHECK (campaign_type IN ('trade_fair', 'event'));

ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;
ALTER TABLE marketing_campaigns ADD  CONSTRAINT marketing_campaigns_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'closed'));

-- source reuses the existing LeadSource enum (lib/marketing/classification.ts SOURCES) —
-- not a new pick-list, so campaign.source and prospects/prospect_needs.source stay
-- comparable without a mapping table.
ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_source_check;
ALTER TABLE marketing_campaigns ADD  CONSTRAINT marketing_campaigns_source_check
  CHECK (source IN (
    'trade_fair', 'event', 'website', 'instagram', 'linkedin', 'referral',
    'cold_outreach', 'existing_customer', 'partner', 'other'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_campaigns_slug ON marketing_campaigns (slug);
-- code is human-chosen and only meaningfully unique among live (non-deleted) campaigns —
-- a closed/deleted campaign's code may be reused later (mirrors project code conventions).
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_campaigns_code
  ON marketing_campaigns (code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status_dates
  ON marketing_campaigns (status, start_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_owner
  ON marketing_campaigns (owner_user_id) WHERE owner_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_marketing_campaigns_updated_at ON marketing_campaigns;
CREATE TRIGGER trg_marketing_campaigns_updated_at
  BEFORE UPDATE ON marketing_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── SURVEY SUBMISSIONS — one row per public form submit, independent of Prospect ──────
CREATE TABLE IF NOT EXISTS survey_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  prospect_id           UUID REFERENCES prospects(id) ON DELETE SET NULL,
  need_id               UUID REFERENCES prospect_needs(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'needs_review',
  submitted_data        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- raw snapshot of the validated public DTO (never internal fields)
  normalized_email      TEXT,
  normalized_phone      TEXT,
  consent_accepted      BOOLEAN NOT NULL DEFAULT FALSE,
  consent_text_version  TEXT,
  consent_accepted_at   TIMESTAMPTZ,
  language              TEXT,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at          TIMESTAMPTZ,
  error_code            TEXT,    -- internal only — never returned by the public API
  error_message         TEXT,    -- internal only — never returned by the public API
  idempotency_key       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_status_check;
ALTER TABLE survey_submissions ADD  CONSTRAINT survey_submissions_status_check
  CHECK (status IN ('processed', 'needs_review', 'rejected_spam', 'failed'));

CREATE INDEX IF NOT EXISTS idx_survey_submissions_campaign_submitted
  ON survey_submissions (campaign_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_submissions_email
  ON survey_submissions (normalized_email) WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_submissions_phone
  ON survey_submissions (normalized_phone) WHERE normalized_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_submissions_prospect
  ON survey_submissions (prospect_id) WHERE prospect_id IS NOT NULL;
-- One idempotency key is only ever meaningful within one campaign (the client generates
-- it per form-session), and only while it's actually set — most historical rows won't
-- have one if the frontend predates this key, so the index stays partial/narrow.
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_submissions_idempotency
  ON survey_submissions (campaign_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_survey_submissions_updated_at ON survey_submissions;
CREATE TRIGGER trg_survey_submissions_updated_at
  BEFORE UPDATE ON survey_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── CAMPAIGN INTERACTIONS — attribution touchpoint, one per successful submission ─────
CREATE TABLE IF NOT EXISTS campaign_interactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  prospect_id           UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  survey_submission_id  UUID REFERENCES survey_submissions(id) ON DELETE SET NULL,
  interaction_type      TEXT NOT NULL DEFAULT 'survey_submission',
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  source                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaign_interactions DROP CONSTRAINT IF EXISTS campaign_interactions_type_check;
ALTER TABLE campaign_interactions ADD  CONSTRAINT campaign_interactions_type_check
  CHECK (interaction_type IN ('survey_submission'));

CREATE INDEX IF NOT EXISTS idx_campaign_interactions_campaign_prospect
  ON campaign_interactions (campaign_id, prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_interactions_prospect
  ON campaign_interactions (prospect_id);

-- ── PUBLIC RATE LIMITING — fixed-window counter, since no rate-limit infra exists yet ──
-- No shared cache/Redis exists in this repo (verified: no existing convention). A small
-- Postgres-backed fixed window is reliable across serverless instances and cheap at this
-- volume (a trade-fair booth, not internet-scale traffic). Bucket key is caller-defined
-- (e.g. "submit:{ip_hash}" or "submit:{campaign_id}:{ip_hash}") so shared trade-fair WiFi/
-- NAT can be rate-limited per-campaign rather than one global per-IP bucket that would
-- lock out an entire booth (spec §H explicit warning against too-low per-IP limits).
CREATE TABLE IF NOT EXISTS public_rate_limits (
  bucket_key    TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  count         INTEGER NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_start)
);
-- Old windows are cheap to leave (few rows/day at this volume) — no cleanup job needed
-- yet; a future cron can prune rows older than a day if this ever needs housekeeping.

-- Atomic increment-and-check for the fixed-window limiter above — a single INSERT ...
-- ON CONFLICT DO UPDATE ... RETURNING is race-free across concurrent requests (unlike a
-- read-then-write from the API layer, which could double-count under real concurrency).
CREATE OR REPLACE FUNCTION increment_rate_limit(p_bucket_key TEXT, p_window_start TIMESTAMPTZ, p_limit INTEGER)
RETURNS BOOLEAN AS $$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO public_rate_limits (bucket_key, window_start, count)
  VALUES (p_bucket_key, p_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = public_rate_limits.count + 1, updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql;

-- ── PROSPECT ATTRIBUTION — wire the long-placeholder campaign_id + add "latest touch" ──
-- prospects.source_label already behaves as "set once, never overwritten" in every
-- existing write path — kept AS the original-source field (see header). Only the two
-- "latest touch" columns are new.
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS latest_source_label TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS latest_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL;

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_campaign_id_fkey;
ALTER TABLE prospects ADD  CONSTRAINT prospects_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_campaign        ON prospects (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_latest_campaign  ON prospects (latest_campaign_id) WHERE latest_campaign_id IS NOT NULL;

-- ── ROW-LEVEL SECURITY (defense-in-depth — real gate is requireRole() in the API layer) ─
ALTER TABLE marketing_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_rate_limits    ENABLE ROW LEVEL SECURITY;
-- public_rate_limits: no policy at all — only ever touched by the service-role client
-- from the public submission route; RLS default-denies everything else, including anon.

-- marketing_campaigns: same manage/write split as prospects (084) — marketing_pr may
-- only manage campaigns they own/created; manager/general_manager/ops_manager manage all.
DROP POLICY IF EXISTS marketing_campaigns_read ON marketing_campaigns;
CREATE POLICY marketing_campaigns_read ON marketing_campaigns
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr'
      AND (marketing_campaigns.owner_user_id = auth.uid() OR marketing_campaigns.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS marketing_campaigns_write_manage ON marketing_campaigns;
CREATE POLICY marketing_campaigns_write_manage ON marketing_campaigns
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
  );

DROP POLICY IF EXISTS marketing_campaigns_write_own ON marketing_campaigns;
CREATE POLICY marketing_campaigns_write_own ON marketing_campaigns
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND (owner_user_id = auth.uid() OR created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'marketing_pr')
    AND created_by = auth.uid()
  );

-- survey_submissions / campaign_interactions: read/write mirrors marketing_campaigns'
-- manage/write split (campaign ownership decides visibility of its submissions).
DROP POLICY IF EXISTS survey_submissions_read ON survey_submissions;
CREATE POLICY survey_submissions_read ON survey_submissions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM marketing_campaigns c
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE c.id = survey_submissions.campaign_id
        AND (c.owner_user_id = auth.uid() OR c.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS survey_submissions_write_manage ON survey_submissions;
CREATE POLICY survey_submissions_write_manage ON survey_submissions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
  );

DROP POLICY IF EXISTS campaign_interactions_read ON campaign_interactions;
CREATE POLICY campaign_interactions_read ON campaign_interactions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
    OR EXISTS (
      SELECT 1 FROM marketing_campaigns c
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE c.id = campaign_interactions.campaign_id
        AND (c.owner_user_id = auth.uid() OR c.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS campaign_interactions_write_manage ON campaign_interactions;
CREATE POLICY campaign_interactions_write_manage ON campaign_interactions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager','general_manager','ops_manager'))
  );

-- No policy at all for Sales / tlines_pm / trustlines_pm / designers / supply / production /
-- qc / warehouse / logistics / accounting — RLS default-denies, same as every other
-- Marketing table. survey_submissions/campaign_interactions have no *_own row-scoped
-- write policy for marketing_pr — writes to these two tables only ever happen through the
-- public submission service (service-role, RLS bypassed) or the internal stats read path;
-- marketing_pr never needs to write a submission row directly.

-- ── PERMISSIONS — grant the new page key to existing live roles ────────────────────────
-- lib/permissions/catalog.ts DEFAULT_PERMISSIONS only applies when a role has NO stored
-- row in role_definitions; marketing_pr/marketing_manager already have stored rows (070),
-- so a code-only change would silently do nothing for them (same reasoning as 084's RLS
-- widening). Merge the new key into the existing JSONB rather than overwriting it.
DO $$ BEGIN
IF to_regclass('public.role_definitions') IS NULL THEN
  RAISE NOTICE '086: role_definitions missing — skipping permission grant';
  RETURN;
END IF;

UPDATE role_definitions
SET permissions = permissions || '{"page.marketing_campaigns": true}'::jsonb
WHERE name IN ('marketing_pr', 'marketing_manager');

END $$;
