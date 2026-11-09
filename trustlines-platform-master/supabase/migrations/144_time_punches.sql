-- 144: Time punches (mobile app → Mesai: clock in / break / clock out).
--
-- One row per button press, append-only: the punch log IS the record, nothing is edited or
-- deleted by the app. Hours, timesheets and the shift card are computed from it.
--
--   kind         in | break_start | break_end | out
--   punched_at   server time of the press
--   site         where the person said they work today (mobile "Çalışma yeri"), free text
--   lat/lng/accuracy_m  device location when the person allowed it; NULL otherwise.
--                Geofence / shift-time rules are an open HR decision — nothing enforces them yet.
--
-- RLS on with no policies — only the service-role API route (/api/hr/shift) touches it (117 pattern).
-- Additive only. Safe to run more than once.

create table if not exists public.time_punches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,  -- kept when a profile is removed (017 pattern)
  kind        text not null check (kind in ('in', 'break_start', 'break_end', 'out')),
  punched_at  timestamptz not null default now(),
  site        text,
  lat         double precision,
  lng         double precision,
  accuracy_m  double precision,
  source      text not null default 'mobile',
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists time_punches_user_time_idx on public.time_punches (user_id, punched_at desc);
alter table public.time_punches enable row level security;
