-- 158: IT → Phone Numbers — the company's phone lines.
--
-- One row per line: the number, its carrier, which of our firms it belongs to, who holds it and
-- since when, the device it runs on (a company phone by name, the holder's own phone, or none),
-- and the line's account details. password_enc / pin_enc / account_number_enc are encrypted by the
-- app (AES-256-GCM, APP_ENCRYPTION_KEY — lib/crypto/secrets.ts) and only revealed one at a time
-- through an audited route. retired_at set = the line is listed under History. Soft delete.
--
-- RLS on with no policies — only the service-role IT routes touch it (155 pattern).
-- Additive only. Safe to run more than once.

create table if not exists public.it_phone_lines (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null check (char_length(trim(number)) between 3 and 40),
  carrier             text check (carrier is null or char_length(carrier) <= 80),
  firm                text check (firm is null or char_length(firm) <= 80),
  holder_id           uuid references public.profiles(id) on delete set null,
  holder_since        date,
  device_name         text check (device_name is null or char_length(device_name) <= 80),
  personal_device     boolean not null default false,
  device_assigned_at  date,
  email               text check (email is null or char_length(email) <= 254),
  imei                text check (imei is null or char_length(imei) <= 40),
  location            text check (location is null or char_length(location) <= 120),
  start_date          date,
  notes               text check (notes is null or char_length(notes) <= 4000),
  password_enc        text,
  pin_enc             text,
  account_number_enc  text,
  retired_at          timestamptz,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index if not exists it_phone_lines_live_idx on public.it_phone_lines (created_at desc) where deleted_at is null;
create index if not exists it_phone_lines_holder_idx on public.it_phone_lines (holder_id) where deleted_at is null;
alter table public.it_phone_lines enable row level security;
