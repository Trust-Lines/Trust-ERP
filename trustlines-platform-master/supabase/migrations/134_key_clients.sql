-- 134: Key clients — the TLines dashboard's "Clients Opportunity" list.
--
-- Not every Opportunity belongs there: only those of our close clients (the companies on the
-- PROJECTS PROGRESS sheet, R1 10-20-2026). Their deals show on the dashboard even before they
-- are signed, so Trust can follow them — normally Trust only sees a deal once it is Closed Won.
--
-- key_clients        one row per client, with spelling variants (aliases) used for matching an
--                    Opportunity's / Potential's brand or its Prospect's name (lib/keyClients/match.ts).
-- key_client_links   manual decisions that beat the name match: 'include' an Opportunity, a Potential
--                    or a whole Prospect whose name doesn't match (e.g. "Frontier Town Gateway" is TA),
--                    or 'exclude' one that only looks like a client by name.
--
-- Additive only. RLS on with no policies — only the service-role API routes, which run their own
-- permission checks, touch these tables (117 pattern). Safe to run more than once.

create table if not exists public.key_clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  aliases     text[] not null default '{}',
  notes       text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create unique index if not exists key_clients_name_uq on public.key_clients (lower(name)) where deleted_at is null;
alter table public.key_clients enable row level security;

create table if not exists public.key_client_links (
  id              uuid primary key default gen_random_uuid(),
  key_client_id   uuid not null references public.key_clients(id) on delete cascade,
  opportunity_id  uuid references public.opportunities(id) on delete cascade,
  potential_id    uuid references public.prospect_potentials(id) on delete cascade,
  prospect_id     uuid references public.prospects(id) on delete cascade,
  mode            text not null default 'include' check (mode in ('include', 'exclude')),
  note            text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  check ((opportunity_id is not null)::int + (potential_id is not null)::int + (prospect_id is not null)::int = 1)
);
create unique index if not exists key_client_links_opp_uq on public.key_client_links (key_client_id, opportunity_id) where opportunity_id is not null;
create unique index if not exists key_client_links_potential_uq on public.key_client_links (key_client_id, potential_id) where potential_id is not null;
create unique index if not exists key_client_links_prospect_uq on public.key_client_links (key_client_id, prospect_id) where prospect_id is not null;
create index if not exists key_client_links_client_idx on public.key_client_links (key_client_id);
alter table public.key_client_links enable row level security;

-- The clients on the PROJECTS PROGRESS sheet (R1, 10-20-2026), with the spellings used there and
-- in ClickUp. Re-running doesn't duplicate or overwrite.
insert into public.key_clients (name, aliases) values
  ('Provisions',            array['Provision']),
  ('HUB',                   array[]::text[]),
  ('Teddy',                 array['Teddys', 'Teddy''s', 'Teddy/Cosmos', 'Teddy Cosmos']),
  ('MOGOS',                 array[]::text[]),
  ('One Convenient Stop',   array['One Conveint Stop', 'One Convenient St']),
  ('Lenox',                 array[]::text[]),
  ('Petro',                 array[]::text[]),
  ('HISPEED',               array['Hi Speed', 'Hi-Speed']),
  ('VGO',                   array['VGO Market']),
  ('NEXTSTOP',              array['Next Stop']),
  ('TA',                    array['TA Adirondak', 'TA Adirondack', 'TA Junction', 'TravelCenters of America', 'Frontier Town Gateway']),
  ('Grand PA Joes',         array['Grandpa Joes', 'Grand Pa Joe''s', 'Grandpa Joe''s']),
  ('SPEEDY',                array[]::text[]),
  ('Grands',                array[]::text[]),
  ('RAMS',                  array[]::text[]),
  ('Fast Stop',             array['Faststop']),
  ('PARK & GO',             array['Park and Go', 'Park N Go']),
  ('ADAMS',                 array[]::text[]),
  ('Chestnut Market',       array[]::text[]),
  ('ALBURAK',               array['Al Burak', 'Al-Burak']),
  ('Your Choice',           array[]::text[]),
  ('SNK',                   array[]::text[]),
  ('Eagle Nest',            array['Eaglenest']),
  ('Live Oak',              array['Liveoak']),
  ('Friendly Porch',        array['Freindly Porch']),
  ('MAX GRAB N GO',         array['Max Grab and Go', 'Max Grab & Go']),
  ('MY MARKET',             array[]::text[]),
  ('Brew Oil',              array[]::text[]),
  ('United Market',         array['United Express']),
  ('Jerrys Market',         array['Jerry''s Market']),
  ('Sibley Mart',           array[]::text[]),
  ('SJK',                   array[]::text[]),
  ('The Shop',              array[]::text[]),
  ('Bob Ajula',             array[]::text[]),
  ('Neighborhood Store',    array[]::text[]),
  ('Crossroads',            array[]::text[]),
  ('Refresh Travel Plaza',  array[]::text[])
on conflict do nothing;
