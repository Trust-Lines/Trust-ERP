-- 152_production_pf_flags_groups.sql — the Production tracker's "To do" / "Receive Follow Up"
-- flags and PF groups, as on the Trust System Projects board (Today's PFs, PF Groups).
--
--   production_pf_flags          a project + type (or one PF row) flagged for today's work:
--                                kind PF (To do), FOLLOWUP (Receive Follow Up) or ORDER.
--   production_pf_groups         numbered groups ("Group 1", "Group 2" …)
--   production_pf_group_members  project + type in a group, with its rank.
--
-- Copied from the Trust System by scripts/copy-trust-production.mts (trust_id keeps the copy
-- re-runnable). Additive; safe to run more than once.

CREATE TABLE IF NOT EXISTS production_pf_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL CHECK (kind IN ('PF', 'ORDER', 'FOLLOWUP')),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,                       -- Millwork / Shelving / … or a custom type's name
  item_id      UUID REFERENCES production_items(id) ON DELETE CASCADE,  -- ORDER flags point at one PF row
  completed_at TIMESTAMPTZ,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  trust_id     TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS production_pf_flags_trust_id_key ON production_pf_flags (trust_id) WHERE trust_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS production_pf_flags_project_idx ON production_pf_flags (project_id);

CREATE TABLE IF NOT EXISTS production_pf_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number     INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trust_id   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS production_pf_groups_number_key ON production_pf_groups (number);
CREATE UNIQUE INDEX IF NOT EXISTS production_pf_groups_trust_id_key ON production_pf_groups (trust_id) WHERE trust_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS production_pf_group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES production_pf_groups(id) ON DELETE CASCADE,
  rank       INTEGER NOT NULL DEFAULT 1,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trust_id   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS production_pf_group_members_trust_id_key ON production_pf_group_members (trust_id) WHERE trust_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS production_pf_group_members_group_idx ON production_pf_group_members (group_id);

-- Same rule as production_items (080): Trust-internal, never tlines_pm. The app reads and writes
-- through the service-role API routes.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['production_pf_flags', 'production_pf_groups', 'production_pf_group_members'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format($p$CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (
      NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'tlines_pm'))$p$, t || '_select', t);
  END LOOP;
END $$;
