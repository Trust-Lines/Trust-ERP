-- 105_create_document_approval_rpc.sql — restores a critical, undocumented gap: the
-- `create_document_approval` RPC that BOTH real call sites (app/api/projects/[id]/doc-approvals/
-- route.ts's "initiate" mode, and app/api/dropbox/link-file/route.ts) depend on to insert every
-- single stage row of every document approval chain — was referenced everywhere in the
-- application code and documented in SYSTEM_ARCHITECTURE.md/CURRENT_SYSTEM_STATE.md ("Satırlar
-- create_document_approval RPC ile eklenir — PostgREST şema-cache'ini atlamak için"), but had NO
-- CREATE FUNCTION anywhere in supabase/migrations/. It must have been created directly against
-- some environment's live database via the SQL editor at some point and never captured as a
-- migration — meaning THIS dev database (and any fresh environment built from migrations alone)
-- never had it at all.
--
-- Found live, 2026-08-28 (Roadmap Month 2, tasks 12/13 — Shop Drawings / Trust PM approvals):
-- calling the RPC with the exact parameter names both real call sites use failed with
-- "Could not find the function public.create_document_approval(...) in the schema cache" — i.e.
-- initiating ANY document's approval chain (plan_layout, proposal, construction_drawings,
-- shop_drawing, item bundles, PO, PF — every doc type, not just the one this task started from)
-- was silently broken on this database. This migration writes down what the application code has
-- always assumed exists, so it is no longer tribal knowledge living only in a production
-- database's history.
--
-- The exact signature is dictated by the two real call sites — do not rename parameters.

CREATE OR REPLACE FUNCTION create_document_approval(
  p_document_id  UUID,
  p_project_id   UUID,
  p_requested_by UUID,
  p_assigned_to  UUID,
  p_status       TEXT,
  p_stage        INTEGER,
  p_doc_type     TEXT,
  p_version_num  INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO document_approvals (
    document_id, project_id, requested_by, assigned_to, status, stage, doc_type, version_num
  ) VALUES (
    p_document_id, p_project_id, p_requested_by, p_assigned_to, p_status, p_stage, p_doc_type, p_version_num
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- SECURITY DEFINER runs as the function owner (bypassing the caller's RLS on document_approvals,
-- the same trust boundary every other RPC in this codebase uses) — every real caller already runs
-- behind the service-role admin client + its own requireRole()/access check, so this does not
-- widen who can reach the function, only lets the intended callers' inserts succeed.
REVOKE ALL ON FUNCTION create_document_approval FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_document_approval TO authenticated, service_role;
