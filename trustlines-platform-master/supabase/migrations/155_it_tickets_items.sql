-- 155: IT — tickets (requests to IT) and the IT equipment library.
--
-- it_tickets  one request from a person to IT. Anyone with page.it_requests sends their own;
--             people with edit.it see every ticket and close it as solved / not solved (a note is
--             required for not solved). files = [{ id, name, path, size, type }] in Dropbox
--             under /IT/Tickets/<ticket id>/.
-- it_items    one piece of IT equipment (PC, monitor, phone…). status 'assigned' needs a holder
--             (assignee_id). set_label groups items that belong together ("PC 1"). remote_address
--             is the Tailscale / LAN name or IP that "Access Computer" opens with Remote Desktop.
--             location is one of the offices in lib/it/constants.ts (checked in the API, so a new
--             office needs no migration). Soft delete (deleted_at).
--
-- RLS on with no policies — only the service-role API routes touch them (117 pattern).
-- Additive only. Safe to run more than once.

create table if not exists public.it_tickets (
  id               uuid primary key default gen_random_uuid(),
  requester_id     uuid references public.profiles(id) on delete set null,
  subject          text not null check (char_length(trim(subject)) between 1 and 160),
  category         text not null check (category in ('email', 'password_reset', 'hardware', 'software', 'network', 'printer', 'access', 'other')),
  priority         text not null default 'medium' check (priority in ('important', 'medium', 'low')),
  description      text check (description is null or char_length(description) <= 4000),
  needed_by        date,
  files            jsonb not null default '[]'::jsonb,
  status           text not null default 'open' check (status in ('open', 'solved', 'not_solved')),
  resolution_note  text check (resolution_note is null or char_length(resolution_note) <= 4000),
  resolved_by      uuid references public.profiles(id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'not_solved' or char_length(trim(coalesce(resolution_note, ''))) > 0)
);
create index if not exists it_tickets_requester_idx on public.it_tickets (requester_id, created_at desc);
create index if not exists it_tickets_status_idx on public.it_tickets (status, created_at desc);
alter table public.it_tickets enable row level security;

create table if not exists public.it_items (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(trim(name)) between 1 and 120),
  model             text,
  category          text not null check (category in ('full_set', 'pc', 'monitor', 'tv', 'keyboard_set', 'phone', 'laptop', 'printer')),
  location          text,
  status            text not null default 'available' check (status in ('available', 'repair', 'assigned')),
  assignee_id       uuid references public.profiles(id) on delete set null,
  assigned_at       timestamptz,
  set_label         text,
  notes             text,
  specs             jsonb not null default '{}'::jsonb,
  remote_address    text,
  image_path        text,
  image_updated_at  timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists it_items_assignee_idx on public.it_items (assignee_id) where deleted_at is null;
create index if not exists it_items_set_idx on public.it_items (set_label) where deleted_at is null;
alter table public.it_items enable row level security;
