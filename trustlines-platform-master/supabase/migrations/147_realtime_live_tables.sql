-- Live pages (components/platform/shared/LiveRefresh, project detail, design job sheet) listen to
-- these tables over Supabase Realtime, so a change made by the Dropbox webhook shows up at once.
-- documents / document_approvals / document_versions are already published (migration 013).
-- Idempotent: adds only the tables not yet in the publication. RLS still applies to every event.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects', 'project_steps', 'audit_log', 'sales_design_jobs', 'sales_design_versions', 'sales_design_version_files']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
