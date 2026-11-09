-- 142: Installation plan (T-Lines PM → Installation) — the "INSTALLATION PROJECT PLAN" workbook
-- (Installation_Planning-2026-2027.xlsx) moved into the app.
--
-- One row per installation = the workbook's Project Register. Everything else the workbook had
-- (Dashboard, Monthly tabs, Gantt, Team Allocation, alerts, suggested status, installer
-- double-booking) is calculated in the app from these rows (lib/installations/compute.ts) —
-- nothing calculated is stored.
--
--   project_no    as the PM writes it: "#480 STG 1", "#12PG", "#417-STG1" — one project can have
--                 several installations (stages / sections), so it's text and not unique
--   team          "TEAM B( Terrence, Robert,Ronnie, Chris)" — names inside the brackets are the
--                 installers the double-booking check matches; a bare team name counts as one
--   team_size     the head count typed in the workbook; used when the team has no named installers
--   confidence    Confirmed / Tentative / On Hold
--   status        Not Started / In Progress / Completed / Delayed / On Hold (blank = not set)
--
-- RLS on with no policies — only the service-role API routes, which run their own permission
-- check, touch it (117 pattern). Additive only; the seed only runs while the table is empty.

create table if not exists public.installations (
  id             uuid primary key default gen_random_uuid(),
  project_no     text,
  project_name   text,
  branch         text check (branch is null or branch in ('NE', 'SE', 'NW', 'CVW')),
  city_state     text,
  planned_start  date,
  planned_finish date,
  team           text,
  team_size      integer check (team_size is null or team_size >= 0),
  scope          text,
  pm_name        text,
  confidence     text check (confidence is null or confidence in ('Confirmed', 'Tentative', 'On Hold')),
  status         text check (status is null or status in ('Not Started', 'In Progress', 'Completed', 'Delayed', 'On Hold')),
  blockers       text,
  notes          text,
  sort_order     integer not null default 0,
  created_by     uuid references public.profiles(id) on delete set null,
  updated_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists installations_start_idx on public.installations (planned_start);
alter table public.installations enable row level security;

-- The workbook's Project Register as of 09 Nov 2026 (43 rows).
insert into public.installations
  (sort_order, project_no, project_name, branch, city_state, planned_start, planned_finish, team, team_size, scope, pm_name, status, blockers, notes, updated_at)
select * from (values
  ( 1, '#480 STG 1', 'JEWELRY',         'NW',  'WI', date '2026-11-10', date '2026-11-30', 'TEAM EXPRESS EM NW', 6, 'PREMIUM FIT OUT', 'LAYAL', 'Not Started', 'Confirm final installation duration and site details', 'Previously discussed start date: 02 Nov 2026. Team listed in the installation plan.', timestamptz '2026-10-30'),
  ( 2, '#373',       'GRANDS',          'SE',  'GA', date '2026-08-10', date '2026-11-05', 'TEAM B (Terrence, Robert, Ronnie, Chris)', 4, 'STORE MAKER', 'MORRY', 'In Progress', 'GRAPHICS INSTALLATION', null, now()),
  ( 3, '#501',       'TEDDY',           'SE',  'GA', date '2026-11-16', date '2026-12-15', 'TEAM C (Jhon, Allen, Anvey)', 3, 'STORE MAKER', 'MORRY', 'Not Started', null, null, now()),
  ( 4, '#12PG',      'VGO | GROCERY',   'SE',  'SC', date '2026-11-16', date '2027-01-25', 'TEAM B (Terrence, Robert, Ronnie, Chris)', 4, 'STORE MAKER', 'HASHEM', null, null, null, now()),
  ( 5, '#12PW',      'VGO | WHOLESALE', 'SE',  'SC', date '2026-11-16', date '2027-01-25', 'TEAM EXPRESS EM', 7, 'STORE MAKER', 'HASHEM', null, null, null, now()),
  ( 6, '#12PR',      'VGO | RESTAURANT','SE',  'SC', date '2026-12-25', date '2027-01-25', 'TEAM EXPRESS EM', 7, 'STORE MAKER', 'HASHEM', null, null, null, now()),
  ( 7, '#12PSTG2',   'VGO | WHOLESALE', 'SE',  'SC', date '2026-11-16', date '2027-01-25', 'TEAM B (Terrence, Robert, Ronnie, Chris)', 4, 'STORE MAKER', 'MORRY', null, null, null, now()),
  ( 8, '#13P',       'VGO',             'SE',  'SC', date '2027-01-13', date '2027-02-13', null, 0, 'STORE MAKER', null, null, null, null, now()),
  ( 9, '#341',       'TEDDY',           'SE',  'GA', date '2027-01-01', date '2027-01-30', 'TEAM B (Terrence, Robert, Ronnie, Chris)', 4, 'STORE MAKER', 'MORRY', null, null, null, now()),
  (10, '#460',       'TEDDY',           'SE',  'GA', date '2026-11-16', date '2026-12-20', 'TEAM B (Terrence, Robert, Ronnie, Chris)', 4, 'STORE MAKER', 'MORRY', null, null, null, now()),
  (11, '#289',       'TA',              'SE',  'GA', date '2027-01-01', date '2027-01-30', null, 0, 'STORE MAKER', null, null, null, null, now()),
  (12, '#459',       'Grand PA Joes',   'SE',  'FL', date '2027-05-11', date '2027-06-09', null, 0, 'STORE MAKER', null, null, null, null, now()),
  (13, '#253',       'SPEEDY',          'SE',  'GA', date '2026-12-28', date '2027-01-26', null, 0, 'STORE MAKER', null, null, null, null, now()),
  (14, '#261',       'SPEEDY',          'SE',  'GA', date '2026-12-29', date '2027-01-27', null, 0, 'STORE MAKER', null, null, null, null, now()),
  (15, '#311',       'NEXTSTOP',        'SE',  'GA', date '2027-04-25', date '2027-05-22', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (16, '#414',       'HUB',             'SE',  'NC', date '2027-02-16', date '2027-03-30', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (17, '#433',       'HUB',             'SE',  'SC', date '2027-03-16', date '2027-04-14', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (18, '#343',       'Brew Oil',        'NW',  'IA', date '2026-09-30', date '2026-11-06', 'TEAM A (Anas, Imad, His son)', 3, 'STORE MAKER', 'ANAS', 'In Progress', null, null, now()),
  (19, '#407',       'SIBLEY MART',     'NW',  'OH', date '2026-10-26', date '2026-11-30', 'TEAM C (Jhon, Allen, Kevin)', 3, 'STORE MAKER', 'HASHEM', 'In Progress', null, null, now()),
  (20, '#441',       'Eagle Nest',      'NW',  'AR', date '2026-12-20', date '2027-01-20', 'TEAM A (Anas, Imad, His son)', 3, 'STORE MAKER', null, null, null, null, now()),
  (21, '#412',       'LIVE OAK',        'NW',  'LA', date '2027-01-15', date '2027-02-14', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (22, '#420',       'LIVE OAK',        'NW',  'WA', date '2026-12-09', date '2027-01-09', 'TEAM D (Patrick, Said)', 2, 'STORE MAKER', null, null, null, null, now()),
  (23, '#419',       'Brew Oil',        'NW',  'IA', date '2026-12-20', date '2027-01-20', 'TEAM A (Anas, Imad, His son)', 3, 'STORE MAKER', null, null, null, null, now()),
  (24, '#395',       'Brew Oil',        'NW',  'IA', date '2027-03-25', date '2027-04-25', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (25, '#443',       'Eagle Nest',      'NW',  'AR', date '2027-01-25', date '2027-02-26', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (26, '#492',       'JERRYS MARKET',   'NW',  'TX', date '2026-12-15', date '2027-01-15', 'TEAM A (Anas, Imad, His son)', 3, 'STORE MAKER', null, null, null, null, now()),
  (27, '#408M',      'UNITED MARKET',   'NW',  'IL', date '2027-05-15', date '2027-06-20', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (28, '#408EX',     'UNITED EXPRESS',  'NW',  'IL', date '2027-05-25', date '2027-06-25', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (29, '#382',       'TA Junction',     'NW',  'MO', date '2027-05-20', date '2027-06-14', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (30, '#478',       'DSN',             'NE',  'NY', date '2026-12-20', date '2027-01-15', 'TEAM A (Anas, Imad, His son)', 3, 'DESIGN AND BUILD', null, null, null, null, now()),
  (31, '#516',       'SNK',             'NE',  'NY', date '2026-10-28', date '2026-11-02', 'TEAM D (Patrick, Said)', 2, 'STORE MAKER', null, 'Completed', null, null, now()),
  (32, '#409',       'ALBURAK',         'NE',  'NY', date '2026-12-01', date '2027-01-01', 'TEAM A (Anas, Imad, His son)', 3, 'STORE MAKER', null, null, null, null, now()),
  (33, '#490',       'Chestnut Market', 'NE',  'CT', date '2026-12-11', date '2026-12-25', 'TEAM D (Patrick, Said)', 2, 'STORE MAKER', null, null, null, null, now()),
  (34, '#227',       'ADAMS',           'NE',  'CT', date '2027-03-10', date '2027-04-20', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (35, '#417-STG1',  'RAMS',            'NE',  'VA', date '2027-01-01', date '2027-02-02', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (36, '#435',       'PARK & GO',       'NE',  'PA', date '2026-12-01', date '2027-01-01', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (37, '#436',       'PARK & GO',       'NE',  'PA', date '2026-12-01', date '2027-01-01', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (38, '#455',       'TA Adirondak',    'NE',  'NY', date '2027-04-01', date '2027-05-01', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (39, '#440',       'Fast Stop',       'NE',  'NJ', date '2027-02-01', date '2027-03-03', null, 1, 'STORE MAKER', null, null, null, null, now()),
  (40, '#1003',      'LUXURY',          'CVW', 'AZ', date '2026-12-20', date '2027-01-30', 'TEAM A (Anas, Imad, His son)', 3, 'PREMIUM FIT OUT', null, null, null, null, now()),
  (41, '#1202',      'THE SHOP',        'CVW', 'CA', date '2026-10-20', date '2026-11-20', 'TEAM CVW', 1, 'STORE MAKER', null, 'In Progress', null, null, now()),
  (42, '#466',       'DAT JERK',        'NE',  'MD', date '2027-02-02', date '2027-03-03', null, 1, 'DESIGN AND BUILD', null, null, null, null, now()),
  (43, '#262',       'PATEL',           'SE',  'SC', date '2026-12-25', date '2027-01-25', null, 1, 'DESIGN AND BUILD', null, null, null, null, now())
) as seed(sort_order, project_no, project_name, branch, city_state, planned_start, planned_finish, team, team_size, scope, pm_name, status, blockers, notes, updated_at)
where not exists (select 1 from public.installations);
