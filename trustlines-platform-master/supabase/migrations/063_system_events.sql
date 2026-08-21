-- ── Phase 10.2a — system_events (the machine-consumption event log) ───────────
-- The nervous system's spine: "something happened" rows that automation handlers react
-- to. NOT a replacement for `audit_log` — that stays the HUMAN audit trail (who did what).
-- This table is for MACHINES: idempotent triggers for notifications and nudges.
--
-- Additive and re-runnable. Nothing existing is renamed or altered.
--
-- IDEMPOTENCY IS ENFORCED HERE, NOT IN CODE: `dedupe_key` is NOT NULL + UNIQUE, so the
-- same logical event physically cannot be stored twice, no matter how many times a route
-- re-runs (a retry, a double-click, a duplicate webhook). `lib/events/bus.ts` upserts with
-- ignoreDuplicates, so a second emit is a silent no-op and its handlers never fire again.
-- A full (not partial) unique index is deliberate: PostgREST can only infer ON CONFLICT
-- from a full index, which is what makes that upsert work.
--
-- SENSITIVE DATA: `payload` must NEVER carry PF values, vendor prices, internal cost or
-- margin (AGENTS.md §2) — `tlines_pm` can read this table. `sanitizeEventPayload()` in
-- lib/events/bus.ts strips those keys before the insert, and is unit-tested.

CREATE TABLE IF NOT EXISTS system_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,                    -- see SystemEventType in lib/events/types.ts
  project_id    UUID REFERENCES projects(id)    ON DELETE CASCADE,
  lead_id       UUID REFERENCES lead_intake(id) ON DELETE CASCADE,
  entity_table  TEXT NOT NULL,                    -- the row that changed, e.g. 'production_items'
  entity_id     UUID,
  actor_id      UUID REFERENCES profiles(id)    ON DELETE SET NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- NO sensitive field. Ever.
  dedupe_key    TEXT NOT NULL,                    -- unique: the idempotency guarantee
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ                       -- set once the handlers have run
);

-- The idempotency guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_events_dedupe ON system_events(dedupe_key);

-- Every read path this table has: by project (cockpit timeline), by type (automation
-- lookups / A9 dedupe checks), newest-first (feeds), and the unprocessed backlog.
-- Postgres does not index FKs automatically (AGENTS.md §5.6).
CREATE INDEX IF NOT EXISTS idx_system_events_project    ON system_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_type       ON system_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_created    ON system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_lead       ON system_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_system_events_unprocessed ON system_events(created_at) WHERE processed_at IS NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- READ: internal + PM roles. The cockpit timeline (10.3) renders these rows, and
-- `tlines_pm` sees the cockpit — which is safe precisely because the payload carries no
-- sensitive field. Sales/design roles are not on this list; they have no cockpit surface.
DROP POLICY IF EXISTS system_events_read ON system_events;
CREATE POLICY system_events_read ON system_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm',
                           'pm_millwork','pm_ceiling','production_manager','project_manager',
                           'logistics','qc_responsible','accounting','accountant'))
  );

-- WRITE: NO policy on purpose. Events are emitted only by the service-role code path
-- (lib/events/bus.ts), which bypasses RLS. With RLS enabled and no write policy, every
-- non-service-role INSERT/UPDATE/DELETE is denied — no user can forge or replay an event.
