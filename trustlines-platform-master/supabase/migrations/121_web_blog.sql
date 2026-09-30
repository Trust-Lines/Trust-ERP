-- Public website "Blog & News" content. Written by the ERP marketing screens
-- (service-role API layer), read by the website (anon key, published rows only).
-- Depends on 118 (web_can_edit(), web_touch_updated_at()) and 119 (web_settings).
-- (The website repo calls this file 120_web_blog.sql; in the ERP repo 120 was already taken.)
-- Idempotent: safe to run more than once.

create table if not exists public.web_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,                 -- URL: /blog/<slug>
  title           text not null,
  excerpt         text not null default '',             -- card text + article intro
  category        text not null check (category in ('industry-news', 'tips-and-tricks', 'success-stories', 'company-updates')),
  author          text not null default '',
  cover_image_url text not null,                        -- ImageKit URL: card + article hero
  cover_image_alt text,
  published_at    date not null default current_date,   -- shown date; a future date keeps it hidden until then
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Article body blocks (any number, ordered).
--   image_url set  -> text + photo block
--   image_url null -> text block
create table if not exists public.web_post_sections (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.web_posts(id) on delete cascade,
  heading     text,
  body        text,
  image_url   text,
  image_alt   text,
  sort_order  integer not null default 0
);

create index if not exists web_posts_published_idx      on public.web_posts(is_published, published_at desc);
create index if not exists web_post_sections_post_idx   on public.web_post_sections(post_id, sort_order);

drop trigger if exists web_posts_touch on public.web_posts;
create trigger web_posts_touch before update on public.web_posts
  for each row execute function public.web_touch_updated_at();

alter table public.web_posts         enable row level security;
alter table public.web_post_sections enable row level security;

-- Website (anon) reads live posts only; editors also see drafts and scheduled posts.
drop policy if exists "web_posts public read" on public.web_posts;
create policy "web_posts public read" on public.web_posts
  for select using ((is_published and published_at <= current_date) or public.web_can_edit());

drop policy if exists "web_post_sections public read" on public.web_post_sections;
create policy "web_post_sections public read" on public.web_post_sections
  for select using (exists (select 1 from public.web_posts p
                            where p.id = post_id
                              and ((p.is_published and p.published_at <= current_date) or public.web_can_edit())));

-- Direct-client writes: second line of defence (the ERP writes via its service-role API layer).
drop policy if exists "web_posts edit" on public.web_posts;
create policy "web_posts edit" on public.web_posts
  for all using (public.web_can_edit()) with check (public.web_can_edit());

drop policy if exists "web_post_sections edit" on public.web_post_sections;
create policy "web_post_sections edit" on public.web_post_sections
  for all using (public.web_can_edit()) with check (public.web_can_edit());

-- Blog & News page header (public: hero text and an ImageKit URL only).
insert into public.web_settings (key, value) values
  ('blog_page', '{
    "eyebrow": "Tlines Journal",
    "heading": "Blog & News",
    "description": "",
    "hero_image_url": "",
    "hero_image_alt": ""
  }'::jsonb)
on conflict (key) do nothing;
