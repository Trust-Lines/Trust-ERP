-- 159: IT assignment history + IT subscriptions.
--
-- it_assignments: who held an IT asset and when. One row per spell; ended_at null = current.
--   asset_kind 'item'       → it_items.id (the person holding the item)
--   asset_kind 'phone_line' → it_phone_lines.id (the person holding the line, and the company
--                             phone it ran on at the time in device_name)
-- Written by the app when an item / line is assigned, moved or freed. Never edited by hand.
--
-- it_subscriptions: the company's software subscriptions (IT → Subscriptions). The login password
-- is encrypted by the app (AES-256-GCM, APP_ENCRYPTION_KEY) and revealed one at a time through an
-- audited route; only the payment card's last four digits are stored. cancelled_at set = History.
--
-- RLS on with no policies — only the service-role IT routes touch these (155 pattern).
-- Additive only. Safe to run more than once.

create table if not exists public.it_assignments (
  id           uuid primary key default gen_random_uuid(),
  asset_kind   text not null check (asset_kind in ('item', 'phone_line')),
  asset_id     uuid not null,
  person_id    uuid references public.profiles(id) on delete set null,
  device_name  text check (device_name is null or char_length(device_name) <= 80),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  assigned_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists it_assignments_asset_idx on public.it_assignments (asset_kind, asset_id, started_at desc);
create index if not exists it_assignments_person_idx on public.it_assignments (person_id, started_at desc);
create index if not exists it_assignments_open_idx on public.it_assignments (asset_kind, asset_id) where ended_at is null;
alter table public.it_assignments enable row level security;

create table if not exists public.it_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  service       text not null check (char_length(trim(service)) between 1 and 80),
  login_email   text check (login_email is null or char_length(login_email) <= 254),
  logo_url      text check (logo_url is null or char_length(logo_url) <= 500),
  brand_color   text check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  seats         integer check (seats is null or seats between 0 and 100000),
  card_last4    text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  start_date    date,
  due_date      date,
  notes         text check (notes is null or char_length(notes) <= 4000),
  password_enc  text,
  cancelled_at  timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists it_subscriptions_live_idx on public.it_subscriptions (created_at desc) where deleted_at is null;
alter table public.it_subscriptions enable row level security;
