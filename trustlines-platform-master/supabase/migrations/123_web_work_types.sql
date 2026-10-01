-- (The website repo calls this file 121_web_work_types.sql; in the ERP repo 121/122 were already taken.)
-- Kinds of work a website project can include (Ceiling fixtures, Shelving, ...).
-- The Projects page shows them as filter tiles (Figma node 650:10316) and each
-- project lists the ones it covered. Managed from the ERP marketing screens.
-- Depends on 118 (web_projects, web_can_edit(), web_touch_updated_at()).
-- Idempotent: safe to run more than once.

create table if not exists public.web_work_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),  -- stored on projects
  label       text not null,                                                   -- tile caption, e.g. "Ceiling fixtures"
  icon_url    text,                                                            -- cream icon on transparent bg (ImageKit); null = built-in icon for the default slugs
  sort_order  integer not null default 0,                                      -- lower = earlier in the 3-column grid
  is_active   boolean not null default true,                                   -- inactive types disappear from the site
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists web_work_types_touch on public.web_work_types;
create trigger web_work_types_touch before update on public.web_work_types
  for each row execute function public.web_touch_updated_at();

alter table public.web_work_types enable row level security;

drop policy if exists "web_work_types public read" on public.web_work_types;
create policy "web_work_types public read" on public.web_work_types
  for select using (is_active or public.web_can_edit());

-- Direct-client writes: second line of defence (the ERP writes via its service-role API layer).
drop policy if exists "web_work_types edit" on public.web_work_types;
create policy "web_work_types edit" on public.web_work_types
  for all using (public.web_can_edit()) with check (public.web_can_edit());

-- The six types from the design. The site falls back to these same six if the table is empty.
insert into public.web_work_types (slug, label, sort_order) values
  ('ceiling-fixtures', 'Ceiling fixtures', 10),
  ('shelving',         'Shelving',          20),
  ('mill-work',        'Mill-work',         30),
  ('branding',         'Branding',          40),
  ('signage',          'Signage',           50),
  ('furniture',        'Furniture',         60)
on conflict (slug) do nothing;

-- Which of them each project covers (slugs from web_work_types).
alter table public.web_projects
  add column if not exists work_types text[] not null default '{}';

create index if not exists web_projects_work_types_idx on public.web_projects using gin (work_types);

-- Reject slugs that are not in web_work_types. To retire a type, set is_active = false
-- instead of deleting it (the site ignores unknown or inactive slugs on old projects).
create or replace function public.web_projects_check_work_types() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from unnest(new.work_types) as t(slug)
    where not exists (select 1 from public.web_work_types w where w.slug = t.slug)
  ) then
    raise exception 'web_projects.work_types contains a slug that is not in web_work_types';
  end if;
  return new;
end $$;

drop trigger if exists web_projects_work_types_check on public.web_projects;
create trigger web_projects_work_types_check before insert or update of work_types on public.web_projects
  for each row execute function public.web_projects_check_work_types();
