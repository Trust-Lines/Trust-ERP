-- 143: Installation teams (T-Lines PM → Installation → Teams).
--
-- A team is set up once — name, members — and picked on each installation row, instead of typing
-- "TEAM B( Terrence, Robert,Ronnie, Chris)" into every row. The double-booking check, head counts
-- and the installer list read the team's members.
--
--   members  the installers by name ("Terrence"); empty for a crew nobody has named yet
--   size     head count for a crew with no named members ("TEAM EXPRESS EM" = 7)
--   branch   optional — teams travel between branches
--
-- installations.team_id points at the team; installations.team stays as a text snapshot (and is
-- all that rows not linked to a saved team have).
-- RLS on with no policies — only the service-role API routes touch it (117 pattern).
-- Additive only; the seed and the linking only fill what's empty. Safe to run more than once.

create table if not exists public.install_teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  branch      text check (branch is null or branch in ('NE', 'SE', 'NW', 'CVW')),
  members     text[] not null default '{}',
  size        integer check (size is null or size >= 0),
  notes       text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists install_teams_name_idx on public.install_teams (lower(name));
alter table public.install_teams enable row level security;

alter table public.installations add column if not exists team_id uuid references public.install_teams(id) on delete set null;
create index if not exists installations_team_idx on public.installations (team_id);

-- The teams named in the workbook.
insert into public.install_teams (sort_order, name, branch, members, size)
select * from (values
  (1, 'TEAM A',             null,  array['Anas', 'Imad', 'His son'],                 null::integer),
  (2, 'TEAM B',             null,  array['Terrence', 'Robert', 'Ronnie', 'Chris'],   null),
  (3, 'TEAM C',             null,  array['Jhon', 'Allen', 'Anvey'],                  null),
  (4, 'TEAM D',             null,  array['Patrick', 'Said'],                         null),
  (5, 'TEAM EXPRESS EM',    null,  array[]::text[],                                  7),
  (6, 'TEAM EXPRESS EM NW', 'NW',  array[]::text[],                                  6),
  (7, 'TEAM CVW',           'CVW', array[]::text[],                                  1)
) as seed(sort_order, name, branch, members, size)
where not exists (select 1 from public.install_teams);

-- Link every row whose team text is exactly a saved team ("TEAM B (Terrence, Robert, Ronnie,
-- Chris)" / "TEAM EXPRESS EM"). A row with a different crew (e.g. TEAM C with Kevin) stays as text.
update public.installations i
set team_id = t.id
from public.install_teams t
where i.team_id is null
  and i.team is not null
  and lower(trim(i.team)) = lower(t.name || case when cardinality(t.members) > 0 then ' (' || array_to_string(t.members, ', ') || ')' else '' end);
