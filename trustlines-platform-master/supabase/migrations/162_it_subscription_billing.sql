-- 162: IT → Subscriptions, Figma "New Subscription" (1141:14764).
--
--   it_subscriptions.amount         what one billing period costs ("$ 100")
--   it_subscriptions.currency       USD / EUR / TRY / GBP
--   it_subscriptions.billing_cycle  monthly / yearly
--   it_subscriptions.seats          from now on "Maximum Users" — the card shows FULL or
--                                   "N Seats Available" against the users listed
--   it_subscription_users.team_size a team entry ("Team Syria", 22 users) — a name with a head count
--
-- Additive only; safe to run more than once. The app keeps working before this runs (it reads and
-- saves without these columns).

alter table public.it_subscriptions add column if not exists amount numeric(12,2);
alter table public.it_subscriptions add column if not exists currency text;
alter table public.it_subscriptions add column if not exists billing_cycle text;

do $$ begin
  alter table public.it_subscriptions add constraint it_subscriptions_amount_check
    check (amount is null or (amount >= 0 and amount <= 10000000));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.it_subscriptions add constraint it_subscriptions_currency_check
    check (currency is null or currency in ('USD', 'EUR', 'TRY', 'GBP'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.it_subscriptions add constraint it_subscriptions_billing_cycle_check
    check (billing_cycle is null or billing_cycle in ('monthly', 'yearly'));
exception when duplicate_object then null; end $$;

alter table public.it_subscription_users add column if not exists team_size integer;

do $$ begin
  alter table public.it_subscription_users add constraint it_subscription_users_team_size_check
    check (team_size is null or (team_size between 1 and 100000 and person_id is null and name is not null));
exception when duplicate_object then null; end $$;
