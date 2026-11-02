-- 138: Product installation videos — the QR code on a product's packaging sticker.
--
-- Each row is one product (e.g. "IN-FC-48/ F12 BODY") with its installation video in Dropbox
-- (/Design/Product Videos). The sticker's QR code opens /install/<slug>, a public page (no
-- login) with a video player. The slug never changes, so a printed QR keeps working when the
-- video is replaced.
--
-- Additive only. RLS on with no policies — only the service-role API routes touch it: the
-- Design page's (with its own permission check) and the public player route, which reads one
-- row by slug (117 pattern). Safe to run more than once.

create table if not exists public.product_videos (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  product_code  text not null,
  title         text,
  dropbox_path  text,
  file_name     text,
  size_bytes    bigint,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists product_videos_code_idx on public.product_videos (lower(product_code)) where deleted_at is null;
alter table public.product_videos enable row level security;
