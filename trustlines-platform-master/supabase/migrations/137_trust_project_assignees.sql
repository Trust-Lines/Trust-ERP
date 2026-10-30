-- 137: "Assign to" on the TLines dashboard's Trust System cards (Finalization → Shipped).
--
-- Trust projects live in the Trust System, which we only read — so who a project is assigned to
-- on our side is kept here, one row per Trust project (its Trust id; project_no is kept for
-- reading the table by hand, e.g. "490").
--
-- Additive only. RLS on with no policies — only the service-role API route, which runs its own
-- permission check, touches it (117 pattern). Safe to run more than once.

create table if not exists public.trust_project_assignees (
  trust_project_id text primary key,
  project_no       text,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  assigned_by      uuid references public.profiles(id) on delete set null,
  updated_at       timestamptz not null default now()
);
create index if not exists trust_project_assignees_user_idx on public.trust_project_assignees (user_id);
alter table public.trust_project_assignees enable row level security;
