-- ── Phase 10.6 — sales_design document pointers ──────────────────────────────
-- Approved sales-design files are surfaced on the project as `documents` POINTERS
-- (doc_type = 'sales_design'). The bytes stay in Dropbox and are never moved (AGENTS.md
-- §4) — only a metadata row is added, exactly like sales_design_version_files.
--
-- `documents.doc_type` is a Postgres ENUM (migration 001), so the new value must be added
-- to the type before any row can use it. Additive and idempotent.
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction that then USES the new
-- value. This migration only ADDS the value; the application writes it in a later request,
-- so there is no same-transaction hazard.

ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'sales_design';
