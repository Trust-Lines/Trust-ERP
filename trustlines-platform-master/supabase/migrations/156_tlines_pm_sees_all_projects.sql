-- 156: let chosen T-Lines PMs see every project, not only their own.
--
-- A tlines_pm normally sees only projects where projects.tlines_pm_id is them (002 "tlines_own",
-- plus the documents / approvals policies below, and the same check in the app). An admin can now
-- tick "Sees every T-Lines project" on a person (Team → Edit, PATCH /api/team/:id — ops / GM only),
-- which sets profiles.sees_all_projects. PF documents stay hidden either way (doc_type <> 'pf'),
-- and the app still hides PF / cost / margin by role.
--
-- Only the service role (the Team API) may change the flag — a trigger blocks a signed-in user
-- from flipping it on their own profile.
-- Additive; safe to run more than once.

alter table public.profiles add column if not exists sees_all_projects boolean not null default false;

create or replace function public.auth_sees_all_projects()
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce((select sees_all_projects from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.auth_sees_all_projects() to authenticated;

create or replace function public.profiles_guard_sees_all()
returns trigger
language plpgsql
as $$
begin
  if new.sees_all_projects is distinct from old.sees_all_projects
     and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'sees_all_projects can only be changed by an admin';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_sees_all on public.profiles;
create trigger profiles_guard_sees_all
  before update of sees_all_projects on public.profiles
  for each row execute function public.profiles_guard_sees_all();

-- Projects
drop policy if exists "tlines_own" on public.projects;
create policy "tlines_own"
  on public.projects for select
  using (auth_role() = 'tlines_pm' and (tlines_pm_id = auth.uid() or auth_sees_all_projects()));

-- Documents: still never PF
drop policy if exists "tlines_no_pf" on public.documents;
create policy "tlines_no_pf"
  on public.documents for select
  using (
    auth_role() = 'tlines_pm'
    and doc_type != 'pf'
    and (
      auth_sees_all_projects()
      or project_id in (select id from public.projects where tlines_pm_id = auth.uid())
    )
  );

-- Document approvals
drop policy if exists "tlines_approvals" on public.document_approvals;
create policy "tlines_approvals"
  on public.document_approvals for select
  using (
    auth_role() = 'tlines_pm'
    and (
      auth_sees_all_projects()
      or project_id in (select id from public.projects where tlines_pm_id = auth.uid())
    )
  );
