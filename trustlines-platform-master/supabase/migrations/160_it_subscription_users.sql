-- 160: who uses each IT subscription.
--
-- it_subscription_users: one row per user of a subscription — either a person in the system
-- (person_id) or, for someone with no account / email yet, just a typed name. The subscription's
-- user count is the number of rows (it_subscriptions.seats is kept in step by the app). The staff
-- page lists a person's subscriptions from here.
--
-- RLS on with no policies — only the service-role IT routes touch it (155 pattern).
-- Additive only. Safe to run more than once. Needs 159.

create table if not exists public.it_subscription_users (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid not null references public.it_subscriptions(id) on delete cascade,
  person_id        uuid references public.profiles(id) on delete cascade,
  name             text check (name is null or char_length(trim(name)) between 1 and 120),
  created_at       timestamptz not null default now(),
  constraint it_subscription_users_who check (person_id is not null or name is not null)
);
create index if not exists it_subscription_users_sub_idx on public.it_subscription_users (subscription_id);
create index if not exists it_subscription_users_person_idx on public.it_subscription_users (person_id) where person_id is not null;
create unique index if not exists it_subscription_users_person_uq on public.it_subscription_users (subscription_id, person_id) where person_id is not null;
alter table public.it_subscription_users enable row level security;
