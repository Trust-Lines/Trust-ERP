-- 120: marketing_pr may now edit the public website content too (same as the ERP API layer,
-- lib/marketing/roles.ts MARKETING_WRITE_ROLES). Keeps the RLS "second line of defence" from
-- 118 consistent with the API. Idempotent.

create or replace function public.web_can_edit() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('marketing_pr', 'marketing_manager', 'general_manager', 'ops_manager')
  )
$$;
