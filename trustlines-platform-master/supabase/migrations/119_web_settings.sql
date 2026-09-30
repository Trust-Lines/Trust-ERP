-- Editable website settings (page hero text/images now, hero video etc. later).
-- One row per key, value is JSON. Depends on 118 (web_can_edit()).
-- PUBLIC: this table is readable by anyone with the anon key. Store only hero
-- text and ImageKit URLs here, never secrets or internal data.
-- Idempotent: safe to run more than once.

create table if not exists public.web_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create or replace function public.web_touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists web_settings_touch on public.web_settings;
create trigger web_settings_touch before update on public.web_settings
  for each row execute function public.web_touch_updated_at();

alter table public.web_settings enable row level security;

drop policy if exists "web_settings public read" on public.web_settings;
create policy "web_settings public read" on public.web_settings
  for select using (true);

drop policy if exists "web_settings edit" on public.web_settings;
create policy "web_settings edit" on public.web_settings
  for all using (public.web_can_edit()) with check (public.web_can_edit());

-- Projects page header (edited from the ERP; image is an ImageKit URL).
insert into public.web_settings (key, value) values
  ('projects_page', '{
    "eyebrow": "Tlines Gallery",
    "heading": "Projects",
    "description": "",
    "hero_image_url": "",
    "hero_image_alt": ""
  }'::jsonb)
on conflict (key) do nothing;
