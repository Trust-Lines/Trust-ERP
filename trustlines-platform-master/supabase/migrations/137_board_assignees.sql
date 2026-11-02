-- 137: "Assign to" on the TLines dashboard cards — one person per card *per stage*.
--
-- A card's assignee belongs to the stage it is in: when a Trust project moves from Finalization
-- to Technical, the Technical assignee shows (and Finalization's is kept for the record).
--   item_kind  'trust'       a Trust System project (its Trust id — the Trust System is only read)
--              'opportunity' / 'potential'   a Clients Opportunity card
--   stage      the board section: opportunity, finalization, technical, to_production,
--              in_production, shipped
--   label      what the card was ("#490", or the site) — only for reading the table by hand
--
-- Additive only. RLS on with no policies — only the service-role API route, which runs its own
-- permission check, touches it (117 pattern). Safe to run more than once.

create table if not exists public.board_assignees (
  item_kind    text not null check (item_kind in ('trust', 'opportunity', 'potential')),
  item_id      text not null,
  stage        text not null,
  label        text,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  assigned_by  uuid references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (item_kind, item_id, stage)
);
create index if not exists board_assignees_user_idx on public.board_assignees (user_id);
alter table public.board_assignees enable row level security;
