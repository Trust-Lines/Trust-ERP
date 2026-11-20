-- 157: Dashboard stage history — which board step each card was in, and when.
--
-- The Trust System only knows a project's current state, so the dashboard couldn't answer
-- "which projects were in Production during October". A daily job (/api/cron/board-snapshot,
-- lib/board/stageHistory.ts) records every card's current step as a spell: the first and last
-- day it was seen there. Running it twice on one day is harmless (it just extends today's spell).
--
-- item_key = the board card: 'trust:<trust id | installation id>', 'opportunity:<deal id>',
-- 'project:<project id>'. stage = the board section key (opportunity, leads, finalization,
-- technical, to_production, in_production, shipped, ready, installation, completed).

create table if not exists public.board_stage_spells (
  id          uuid primary key default gen_random_uuid(),
  item_key    text not null,
  stage       text not null,
  region      text,
  project_no  text,
  first_day   date not null,
  last_day    date not null,
  created_at  timestamptz not null default now(),
  check (last_day >= first_day)
);

-- Daily job: the open spell of a card in a step. Dashboard: spells touching the last ~13 months.
create index if not exists board_stage_spells_item_idx on public.board_stage_spells (item_key, stage, last_day desc);
create index if not exists board_stage_spells_last_day_idx on public.board_stage_spells (last_day);

-- Read and written only by the server (service role) behind the dashboard's own access checks;
-- no policies = no direct access for signed-in users.
alter table public.board_stage_spells enable row level security;
