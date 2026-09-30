-- Public website "Projects" content. Written by the ERP marketing screens
-- (service-role API layer), read by the website (anon key, published rows only).
-- Idempotent: safe to run more than once.

create table if not exists public.web_projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,                 -- URL: /projects/<slug>
  title           text not null,                        -- "Teddy, Milford"
  category        text not null check (category in ('c-store', 'truck-stops', 'grocery')),
  location        text not null,                        -- card ribbon + meta bar, e.g. "Milford, CT, USA"
  project_type    text,                                 -- meta bar "Type", e.g. "C Store Remodel"
  year_built      integer,                              -- meta bar "Date"
  cover_image_url text not null,                        -- ImageKit URL, gallery card image
  cover_image_alt text,
  is_published    boolean not null default false,
  sort_order      integer not null default 0,           -- lower = earlier; ties: newest first
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Top carousel photos on the project page (any number, ordered).
create table if not exists public.web_project_photos (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.web_projects(id) on delete cascade,
  image_url   text not null,
  alt         text,
  sort_order  integer not null default 0
);

-- Body blocks under the meta bar (any number, ordered).
--   image_url set  -> text + photo block (photo side alternates automatically)
--   image_url null -> full-width text block
create table if not exists public.web_project_sections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.web_projects(id) on delete cascade,
  heading     text,
  body        text,
  image_url   text,
  image_alt   text,
  sort_order  integer not null default 0
);

create index if not exists web_project_photos_project_idx   on public.web_project_photos(project_id, sort_order);
create index if not exists web_project_sections_project_idx on public.web_project_sections(project_id, sort_order);

create or replace function public.web_touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists web_projects_touch on public.web_projects;
create trigger web_projects_touch before update on public.web_projects
  for each row execute function public.web_touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.web_projects         enable row level security;
alter table public.web_project_photos   enable row level security;
alter table public.web_project_sections enable row level security;

-- Who may write: the ERP roles allowed to edit marketing content (see migration 084).
-- marketing_pr is read-only and is intentionally not listed.
-- security definer so the policy can read profiles regardless of the caller's own RLS.
create or replace function public.web_can_edit() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('marketing_manager', 'general_manager', 'ops_manager')
  )
$$;

-- Website (anon) reads published projects only; editors also see drafts.
drop policy if exists "web_projects public read" on public.web_projects;
create policy "web_projects public read" on public.web_projects
  for select using (is_published or public.web_can_edit());

drop policy if exists "web_photos public read" on public.web_project_photos;
create policy "web_photos public read" on public.web_project_photos
  for select using (exists (select 1 from public.web_projects p
                            where p.id = project_id and (p.is_published or public.web_can_edit())));

drop policy if exists "web_sections public read" on public.web_project_sections;
create policy "web_sections public read" on public.web_project_sections
  for select using (exists (select 1 from public.web_projects p
                            where p.id = project_id and (p.is_published or public.web_can_edit())));

-- Direct-client writes: second line of defence. The ERP writes through its
-- service-role API layer (which checks the role itself and bypasses RLS).
drop policy if exists "web_projects edit" on public.web_projects;
create policy "web_projects edit" on public.web_projects
  for all using (public.web_can_edit()) with check (public.web_can_edit());

drop policy if exists "web_photos edit" on public.web_project_photos;
create policy "web_photos edit" on public.web_project_photos
  for all using (public.web_can_edit()) with check (public.web_can_edit());

drop policy if exists "web_sections edit" on public.web_project_sections;
create policy "web_sections edit" on public.web_project_sections
  for all using (public.web_can_edit()) with check (public.web_can_edit());
