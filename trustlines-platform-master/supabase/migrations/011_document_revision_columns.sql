-- Revision workflow columns for documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS dropbox_rev      TEXT,
  ADD COLUMN IF NOT EXISTS revision_count   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_revised_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS form_data        JSONB;
