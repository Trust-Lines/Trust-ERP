-- 090_clickup_opportunities_import.sql — 2026-08-13
--
-- Second half of the ClickUp import (see docs/CLICKUP_IMPORT.md): the real
-- "Opportunities NE" board (176 tasks, grouped by "Status OP" — Potential/READY TO
-- START/MODIFICATION REQUEST/Design Proposal SENT/WAITING/In Target List/DEAL MISSED/
-- DEAL CLOSED). Same additive/traceable pattern as migration 088's Prospect import
-- fields — external_source/external_ref is the dedupe key + audit trail, not a display
-- field. `opportunities.external_stage_label` additionally preserves the EXACT ClickUp
-- wording for display (the user asked for "the same columns" — this is what makes that
-- possible without replacing the internal `stage` enum that lib/sales/salesHandoff.ts's
-- automation already depends on).

ALTER TABLE prospect_needs ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE prospect_needs ADD COLUMN IF NOT EXISTS external_ref    TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_needs_external_ref
  ON prospect_needs (external_source, external_ref) WHERE external_source IS NOT NULL AND external_ref IS NOT NULL;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_source      TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_ref         TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_stage_label TEXT;  -- e.g. "DEAL CLOSED", "WAITING" — the real ClickUp wording, display-only
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_external_ref
  ON opportunities (external_source, external_ref) WHERE external_source IS NOT NULL AND external_ref IS NOT NULL;
