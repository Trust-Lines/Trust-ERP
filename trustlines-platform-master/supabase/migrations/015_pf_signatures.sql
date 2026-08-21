-- Migration 015: PF signatures + render metadata on documents
-- pf_signatures: [{ box, base64, signerName, signedAt }] stamped into the PF PDF.
-- pf_meta: the render params captured at generation so the PF can be re-rendered
-- with signatures without recomputing everything.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS pf_signatures JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pf_meta       JSONB;
