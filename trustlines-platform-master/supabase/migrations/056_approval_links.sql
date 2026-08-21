-- 056_approval_links.sql
-- Phase 5 — External Review Link (PROJECT-MASTER-PLAN §10). The first customer-facing
-- feature: a secure, account-less link that lets an end customer view a document and
-- approve / request revision / reject / comment.
--
--   approval_links        — one shareable review link (token HASH only, never plaintext).
--   approval_link_events  — the audit trail (opened / verified / approved / … + IP/UA).
--
-- SECURITY (also enforced in the public API):
--   • The token is NEVER stored in plaintext — only sha256(token). The plaintext is
--     shown once at creation.
--   • Links expire, can be revoked, and can cap max_views.
--   • The public route reads via the service-role client + token verification; it must
--     NEVER expose PF / vendor price / margin / internal fields.
--   • Approval is idempotent — a completed link cannot be actioned again.
--
-- Additive; RLS ENABLED for the INTERNAL app views (the public route bypasses RLS via
-- the service-role client, gated entirely by the token). TEXT role model.

CREATE TABLE IF NOT EXISTS approval_links (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                 UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id                UUID REFERENCES documents(id) ON DELETE SET NULL,
  document_version_id        UUID,                                 -- optional version-set id (loose)
  customer_contact_id        UUID REFERENCES customer_contacts(id) ON DELETE SET NULL,
  title                      TEXT,                                 -- what the customer sees
  token_hash                 TEXT NOT NULL UNIQUE,                 -- sha256(token) — never the token itself
  status                     TEXT NOT NULL DEFAULT 'active',       -- active | completed | revoked | expired
  decision                   TEXT,                                 -- approved | rejected | revision_requested
  expires_at                 TIMESTAMPTZ,
  max_views                  INTEGER,
  view_count                 INTEGER NOT NULL DEFAULT 0,
  require_email_verification BOOLEAN NOT NULL DEFAULT TRUE,
  created_by                 UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_opened_at            TIMESTAMPTZ,
  completed_at               TIMESTAMPTZ,
  revoked_at                 TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE approval_links DROP CONSTRAINT IF EXISTS approval_links_status_check;
ALTER TABLE approval_links ADD CONSTRAINT approval_links_status_check
  CHECK (status IN ('active', 'completed', 'revoked', 'expired'));

CREATE INDEX IF NOT EXISTS idx_al_project  ON approval_links(project_id);
CREATE INDEX IF NOT EXISTS idx_al_document ON approval_links(document_id);
-- token_hash already has a UNIQUE index (used for O(1) public lookup).

DROP TRIGGER IF EXISTS trg_al_updated_at ON approval_links;
CREATE TRIGGER trg_al_updated_at BEFORE UPDATE ON approval_links FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS approval_link_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_link_id UUID NOT NULL REFERENCES approval_links(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,   -- opened | verified | approved | rejected | revision_requested | comment | revoked
  actor_name       TEXT,
  actor_email      TEXT,
  comment          TEXT,
  ip               TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ale_link ON approval_link_events(approval_link_id);

-- ── RLS (internal app views only; public route uses the service-role client) ──
ALTER TABLE approval_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_link_events ENABLE ROW LEVEL SECURITY;

-- Internal roles that manage customer approvals (ops/gm + both PMs).
DROP POLICY IF EXISTS approval_links_rw ON approval_links;
CREATE POLICY approval_links_rw ON approval_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  );

DROP POLICY IF EXISTS approval_link_events_read ON approval_link_events;
CREATE POLICY approval_link_events_read ON approval_link_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm'))
  );
