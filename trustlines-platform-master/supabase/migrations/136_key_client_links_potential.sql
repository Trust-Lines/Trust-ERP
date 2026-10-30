-- 136: key_client_links.potential_id — catch-up for databases where an early draft of 134 created
-- key_client_links before Potentials could be linked (134's "create table if not exists" then
-- skipped the new column). Without it the dashboard's Clients Opportunity list can't load.
--
-- Additive only. Safe to run more than once, and a no-op where 134 already made the column.

alter table public.key_client_links
  add column if not exists potential_id uuid references public.prospect_potentials(id) on delete cascade;

-- The draft's "exactly one target" check only knew Opportunity / Prospect — replace it so a
-- Potential-only link is allowed too.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.key_client_links'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%opportunity_id%'
  loop
    execute format('alter table public.key_client_links drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.key_client_links
  add constraint key_client_links_one_target
  check ((opportunity_id is not null)::int + (potential_id is not null)::int + (prospect_id is not null)::int = 1);

create unique index if not exists key_client_links_potential_uq on public.key_client_links (key_client_id, potential_id) where potential_id is not null;
