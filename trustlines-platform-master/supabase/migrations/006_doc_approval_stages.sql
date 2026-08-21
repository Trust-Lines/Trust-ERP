-- Migration 006: Multi-stage approval columns for document_approvals
-- Adds stage number and assigned approver so plan_layout/proposal docs
-- can go through Trust PM → Client PM sequential approval.

-- Drop the old status constraint and replace it with one that includes 'waiting'
ALTER TABLE document_approvals DROP CONSTRAINT IF EXISTS document_approvals_status_check;
ALTER TABLE document_approvals
  ADD CONSTRAINT document_approvals_status_check
  CHECK (status IN ('pending', 'waiting', 'approved', 'rejected'));

ALTER TABLE document_approvals
  ADD COLUMN IF NOT EXISTS stage        INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_to  UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS doc_type     TEXT,
  ADD COLUMN IF NOT EXISTS version_num  INTEGER;
