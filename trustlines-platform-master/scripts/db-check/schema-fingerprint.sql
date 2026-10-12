-- READ-ONLY. Changes nothing.
-- Run in the Supabase SQL editor of the database you want to check, copy the single JSON
-- cell of the result into a file (e.g. test.json / main.json) and run:
--   npx tsx scripts/db-check/compare-db.mts test.json [main.json]
select jsonb_build_object(
  'tables', coalesce((
    select jsonb_agg(table_name order by table_name)
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'), '[]'),
  'views', coalesce((
    select jsonb_agg(table_name order by table_name)
    from information_schema.views where table_schema = 'public'), '[]'),
  'columns', coalesce((
    select jsonb_agg(table_name || '.' || column_name || ':' || data_type order by table_name, column_name)
    from information_schema.columns where table_schema = 'public'), '[]'),
  'indexes', coalesce((
    select jsonb_agg(indexname order by indexname)
    from pg_indexes where schemaname = 'public'), '[]'),
  'policies', coalesce((
    select jsonb_agg(tablename || '.' || policyname order by tablename, policyname)
    from pg_policies where schemaname in ('public', 'storage')), '[]'),
  'rls_enabled', coalesce((
    select jsonb_agg(c.relname order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity), '[]'),
  'functions', coalesce((
    select jsonb_agg(distinct p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'), '[]'),
  'triggers', coalesce((
    select jsonb_agg(c.relname || '.' || t.tgname order by c.relname, t.tgname)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname in ('public', 'auth', 'storage')), '[]'),
  'types', coalesce((
    select jsonb_agg(t.typname order by t.typname)
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype in ('e', 'd')), '[]'),
  'enum_values', coalesce((
    select jsonb_agg(t.typname || '.' || e.enumlabel order by t.typname, e.enumsortorder)
    from pg_enum e join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'), '[]'),
  'realtime', coalesce((
    select jsonb_agg(tablename order by tablename)
    from pg_publication_tables where pubname = 'supabase_realtime'), '[]'),
  'role_definitions', case when to_regclass('public.role_definitions') is null then '[]'::jsonb else
    (xpath('/row/j/text()', query_to_xml(
      'select coalesce(jsonb_agg(name order by name), ''[]'') as j from public.role_definitions',
      false, true, '')))[1]::text::jsonb end,
  -- one entry per role + permission key, so permission seeds (004, 020, 047, 052…) can be compared too
  'role_permissions', case when to_regclass('public.role_definitions') is null then '[]'::jsonb else
    (xpath('/row/j/text()', query_to_xml(
      'select coalesce(jsonb_agg(r.name || ''.'' || p.key || ''='' || p.value order by r.name, p.key), ''[]'') as j
         from public.role_definitions r, jsonb_each_text(coalesce(r.permissions, ''{}''::jsonb)) p',
      false, true, '')))[1]::text::jsonb end
) as fingerprint;
