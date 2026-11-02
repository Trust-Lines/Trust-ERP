-- 138: Products' packaging stickers and their installation videos (the sticker's QR code).
--
-- Each row is one product (e.g. "IN-FC-48/ F12 BODY"): what its Store Maker packaging sticker
-- shows (category, name, specifications, collection, colour, drawing) and its installation video,
-- both in Dropbox (/Design/Product Videos). The video can come later.
-- The sticker's QR code opens /install/<slug>, a public page (no login) with a video player. The
-- slug never changes, so a printed QR keeps working when the video is added or replaced.
--
-- Additive only. RLS on with no policies — only the service-role API routes touch it: the
-- Design page's (with its own permission check) and the public player route, which reads one
-- row by slug (117 pattern). Safe to run more than once.

create table if not exists public.product_videos (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  product_code  text not null,
  title         text,              -- product name on the sticker: FRONT SHELVES 48"
  category      text,              -- "Front Counter | Cashier Area"
  specs         text[] not null default '{}',
  collection    text,
  color_name    text,
  color_hex     text,
  image_path    text,              -- the product drawing (Dropbox)
  dropbox_path  text,              -- the installation video (Dropbox); null until uploaded
  file_name     text,
  size_bytes    bigint,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists product_videos_code_idx on public.product_videos (lower(product_code)) where deleted_at is null;
alter table public.product_videos enable row level security;
