-- Migration 010: Change audit_log.project_id FK from RESTRICT → SET NULL
-- Reason: permanently deleting a project must not be blocked by its own audit trail.
-- SET NULL preserves the log entry (actor, action, timestamp) while unlinking the
-- deleted project — the audit record is still useful for compliance history.

ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_project_id_fkey;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_project_id_fkey
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE SET NULL;
