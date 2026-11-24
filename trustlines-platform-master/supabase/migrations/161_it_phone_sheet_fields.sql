-- 161: IT → Phone Numbers, the fields of the "Phones and sim cards info" sheet.
--
-- it_phone_lines
--   holder_name       the user when they have no account / email yet (holder_id null). Never both.
--   account_holder    the carrier account's holder, e.g. "TAISSIER ALRAHWANJI" (firm = "T LINES LLC").
--   monthly_cost      the line's plan per month in USD, e.g. 58.10.
--   device_condition  the company phone: 'new' or 'used'.
-- it_assignments
--   person_name       a typed holder in the history (person_id null).
--
-- Additive only. Safe to run more than once. Needs 158 and 159.

alter table public.it_phone_lines add column if not exists holder_name text;
alter table public.it_phone_lines add column if not exists account_holder text;
alter table public.it_phone_lines add column if not exists monthly_cost numeric(10, 2);
alter table public.it_phone_lines add column if not exists device_condition text;

do $$ begin
  alter table public.it_phone_lines add constraint it_phone_lines_holder_name_len check (holder_name is null or char_length(trim(holder_name)) between 1 and 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.it_phone_lines add constraint it_phone_lines_account_holder_len check (account_holder is null or char_length(account_holder) <= 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.it_phone_lines add constraint it_phone_lines_monthly_cost_range check (monthly_cost is null or (monthly_cost >= 0 and monthly_cost <= 100000));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.it_phone_lines add constraint it_phone_lines_device_condition_ok check (device_condition is null or device_condition in ('new', 'used'));
exception when duplicate_object then null; end $$;

alter table public.it_assignments add column if not exists person_name text;
do $$ begin
  alter table public.it_assignments add constraint it_assignments_person_name_len check (person_name is null or char_length(person_name) <= 120);
exception when duplicate_object then null; end $$;
