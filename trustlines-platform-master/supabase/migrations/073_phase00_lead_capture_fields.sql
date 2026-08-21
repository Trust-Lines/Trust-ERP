-- 073_phase00_lead_capture_fields.sql — Lead Capture wizard fields
--
-- The Marketing UI is being redesigned around a guided "Lead Capture" wizard
-- (PHASE-00-MARKETING-LEAD-OPPORTUNITY-ORIGINATION.md §4 Source/Company/Contact/
-- Project Need/Timing/Classification steps). Migration 072's `prospects` table only
-- covered the §3 core schema — it has no columns for source, project/scope type,
-- timing, or the classification preview the wizard's last step shows. This migration
-- adds them, additively, to the SAME tables (no new table, no rename — "keep the
-- existing database work" per instruction).
--
-- Classification values reuse the EXISTING prospects.status CHECK from 072 —
-- 'captured' (Lead) / 'potential' (Potential) / 'opportunity_candidate'
-- (Opportunity Candidate) / 'disqualified' (Disqualified) already cover the wizard's
-- four classification options 1:1. No enum change needed there.

-- ── prospects: Source (Step 1) ─────────────────────────────────
-- source_id (nullable FK) already exists from 072, pointed at the not-yet-built
-- marketing_sources table (Phase 00.6). Until then, source is free-text — same
-- pattern lead_intake.source already uses.
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_label TEXT;

-- ── prospects: Project Need (Step 4) ────────────────────────────
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS project_types        TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS scope_types           TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS has_active_project    BOOLEAN;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS project_count         INTEGER;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS deadline              DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS expected_start_date   DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS layout_available      BOOLEAN;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS site_ready            BOOLEAN;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS budget_range          TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes                 TEXT;

-- ── prospects: Timing (Step 5) ──────────────────────────────────
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS timing               TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS target_contact_date  DATE;

-- ── prospects: Classification preview + override (Step 6) ──────
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS classification_reasons         TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_action                    TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_action_date               DATE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS classification_overridden     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS classification_override_reason TEXT;

-- Required-reason invariant: an override without a reason is a data-integrity bug,
-- not just a UI validation nicety — enforce it at the DB too.
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_override_reason_check;
ALTER TABLE prospects ADD  CONSTRAINT prospects_override_reason_check
  CHECK (classification_overridden = FALSE OR classification_override_reason IS NOT NULL);

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_project_types_check;
ALTER TABLE prospects ADD  CONSTRAINT prospects_project_types_check
  CHECK (project_types <@ ARRAY['full_remodel','small_remodel','new_construction','bid']::TEXT[]);

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_scope_types_check;
ALTER TABLE prospects ADD  CONSTRAINT prospects_scope_types_check
  CHECK (scope_types <@ ARRAY['millwork','shelving','ceiling','image','furniture','decoration','graphic','shop_drawing']::TEXT[]);

ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_timing_check;
ALTER TABLE prospects ADD  CONSTRAINT prospects_timing_check
  CHECK (timing IS NULL OR timing IN ('immediate','0_3_months','3_6_months','6_12_months','12_plus_months','no_current_project','contact_later'));

-- "Contact later" without a target date defeats the whole point of the timing step —
-- the wizard requires it client-side; the DB backs that up.
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_contact_later_needs_date_check;
ALTER TABLE prospects ADD  CONSTRAINT prospects_contact_later_needs_date_check
  CHECK (timing IS DISTINCT FROM 'contact_later' OR target_contact_date IS NOT NULL);

-- ── prospect_contacts: preferred contact method (Step 3) ────────
ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;

-- ── Indexes for the new Lead Cloud list filters/columns ─────────
CREATE INDEX IF NOT EXISTS idx_prospects_timing              ON prospects (timing) WHERE timing IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_target_contact_date ON prospects (target_contact_date) WHERE target_contact_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_project_types       ON prospects USING GIN (project_types);
CREATE INDEX IF NOT EXISTS idx_prospects_scope_types         ON prospects USING GIN (scope_types);
