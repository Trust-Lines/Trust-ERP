-- 139: Product videos, part 2.
--
-- 1. The packaging-sticker fields on product_videos — for databases where 138 ran before they
--    were added to it (a no-op where 138 already made them).
-- 2. product_video_upload_links: shareable links (no login) for the production floor to upload
--    installation videos. Whoever has /video-upload/<token> can add a product's video and get its
--    QR code — until the link is revoked on Design → Product Videos.
--
-- Additive only. RLS on with no policies — only the service-role API routes touch them (117
-- pattern). Safe to run more than once.

alter table public.product_videos add column if not exists category   text;
alter table public.product_videos add column if not exists specs      text[] not null default '{}';
alter table public.product_videos add column if not exists collection text;
alter table public.product_videos add column if not exists color_name text;
alter table public.product_videos add column if not exists color_hex  text;
alter table public.product_videos add column if not exists image_path text;
alter table public.product_videos add column if not exists uploaded_via uuid;   -- the upload link used, if any

create table if not exists public.product_video_upload_links (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  label       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
alter table public.product_video_upload_links enable row level security;
