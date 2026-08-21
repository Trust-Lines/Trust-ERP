-- Migration 017: Allow deleting a user (profile) without FK violations.
-- Every nullable column that references profiles(id) is switched to ON DELETE SET
-- NULL, so deleting a person unlinks their history (audit, approvals, assignments)
-- instead of blocking. Each statement is guarded so a missing table/column in a
-- given DB doesn't abort the whole migration.

-- audit_log.actor_id (the reported blocker)
DO $$ BEGIN
  ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
  ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- documents
DO $$ BEGIN
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;
  ALTER TABLE documents ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_approved_by_fkey;
  ALTER TABLE documents ADD CONSTRAINT documents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_signed_by_fkey;
  ALTER TABLE documents ADD CONSTRAINT documents_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- document_approvals
DO $$ BEGIN
  ALTER TABLE document_approvals DROP CONSTRAINT IF EXISTS document_approvals_requested_by_fkey;
  ALTER TABLE document_approvals ADD CONSTRAINT document_approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE document_approvals DROP CONSTRAINT IF EXISTS document_approvals_approved_by_fkey;
  ALTER TABLE document_approvals ADD CONSTRAINT document_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE document_approvals DROP CONSTRAINT IF EXISTS document_approvals_assigned_to_fkey;
  ALTER TABLE document_approvals ADD CONSTRAINT document_approvals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- projects (all PM / manager / creator references)
DO $$ BEGIN ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_ops_manager_id_fkey;   ALTER TABLE projects ADD CONSTRAINT projects_ops_manager_id_fkey   FOREIGN KEY (ops_manager_id)   REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_trustlines_pm_id_fkey; ALTER TABLE projects ADD CONSTRAINT projects_trustlines_pm_id_fkey FOREIGN KEY (trustlines_pm_id) REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_tlines_pm_id_fkey;     ALTER TABLE projects ADD CONSTRAINT projects_tlines_pm_id_fkey     FOREIGN KEY (tlines_pm_id)     REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_prod_pm_ms_id_fkey;    ALTER TABLE projects ADD CONSTRAINT projects_prod_pm_ms_id_fkey    FOREIGN KEY (prod_pm_ms_id)    REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_prod_pm_ci_id_fkey;    ALTER TABLE projects ADD CONSTRAINT projects_prod_pm_ci_id_fkey    FOREIGN KEY (prod_pm_ci_id)    REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_qc_inspector_id_fkey;  ALTER TABLE projects ADD CONSTRAINT projects_qc_inspector_id_fkey  FOREIGN KEY (qc_inspector_id)  REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;       ALTER TABLE projects ADD CONSTRAINT projects_created_by_fkey       FOREIGN KEY (created_by)       REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- misc history tables
DO $$ BEGIN ALTER TABLE project_notes DROP CONSTRAINT IF EXISTS project_notes_author_id_fkey; ALTER TABLE project_notes ADD CONSTRAINT project_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE stage_transitions DROP CONSTRAINT IF EXISTS stage_transitions_transitioned_by_fkey; ALTER TABLE stage_transitions ADD CONSTRAINT stage_transitions_transitioned_by_fkey FOREIGN KEY (transitioned_by) REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE qc_checklists DROP CONSTRAINT IF EXISTS qc_checklists_conducted_by_fkey; ALTER TABLE qc_checklists ADD CONSTRAINT qc_checklists_conducted_by_fkey FOREIGN KEY (conducted_by) REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE client_franchises DROP CONSTRAINT IF EXISTS client_franchises_pm_id_fkey; ALTER TABLE client_franchises ADD CONSTRAINT client_franchises_pm_id_fkey FOREIGN KEY (pm_id) REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- notifications belong to the user → delete them with the user
DO $$ BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
  ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;
