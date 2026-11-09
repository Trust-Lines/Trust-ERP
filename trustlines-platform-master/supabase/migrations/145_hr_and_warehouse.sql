-- 145: HR requests + shift plans + warehouse locations (mobile app: HR, Depo).
--
-- hr_requests   one row per request from a person, decided by their manager (profiles.manager_id)
--               or ops_manager / general_manager.
--   kind        leave       — reason vacation | sick | personal, start_date..end_date
--                             (matches the web HR "Requests" board: HrRequest reason/date/endDate)
--               correction  — a missed / wrong punch: correction_kind at correction_at; approving
--                             it writes that punch into time_punches (source 'correction')
--   files       reserved for attachments (jsonb, [] until HR uploads exist)
-- hr_shifts     a planned shift for one person on one day (manager plans, person sees own).
-- warehouse_locations  where a production item sits in a warehouse ("B-3-12"; free text until the
--               shelf-code format is decided). One row per item; receiving / put-away write it.
--
-- Leave entitlement / accrual and geofence rules are open HR decisions — nothing here enforces them.
-- RLS on with no policies — only the service-role API routes touch them (117 pattern).
-- Additive only. Safe to run more than once.

create table if not exists public.hr_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete set null,
  kind             text not null check (kind in ('leave', 'correction')),
  reason           text check (reason is null or reason in ('vacation', 'sick', 'personal')),
  start_date       date,
  end_date         date,
  correction_kind  text check (correction_kind is null or correction_kind in ('in', 'break_start', 'break_end', 'out')),
  correction_at    timestamptz,
  priority         text not null default 'medium' check (priority in ('important', 'medium', 'low')),
  description      text,
  files            jsonb not null default '[]'::jsonb,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note    text,
  decided_by       uuid references public.profiles(id) on delete set null,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (kind <> 'leave' or (reason is not null and start_date is not null and end_date is not null and end_date >= start_date)),
  check (kind <> 'correction' or (correction_kind is not null and correction_at is not null))
);
create index if not exists hr_requests_user_idx on public.hr_requests (user_id, created_at desc);
create index if not exists hr_requests_status_idx on public.hr_requests (status, created_at desc);
alter table public.hr_requests enable row level security;

create table if not exists public.hr_shifts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  shift_date  date not null,
  start_time  time not null,
  end_time    time not null,
  site        text,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists hr_shifts_user_date_idx on public.hr_shifts (user_id, shift_date);
create index if not exists hr_shifts_date_idx on public.hr_shifts (shift_date);
alter table public.hr_shifts enable row level security;

create table if not exists public.warehouse_locations (
  production_item_id  uuid primary key references public.production_items(id) on delete cascade,
  location            text not null,
  received_at         timestamptz,
  updated_by          uuid references public.profiles(id) on delete set null,
  updated_at          timestamptz not null default now()
);
create index if not exists warehouse_locations_location_idx on public.warehouse_locations (location);
alter table public.warehouse_locations enable row level security;
