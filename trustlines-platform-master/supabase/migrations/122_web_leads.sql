-- 122_web_leads.sql — Website contact-form / newsletter inbox.
--
-- Submissions from the public website (sm.tlines.us) land HERE, deliberately separate from
-- `prospects`: marketing reviews them and converts the good ones into a Contact by hand
-- (web_leads.prospect_id remembers the link). Nothing from the website ever touches
-- prospects/customers/projects on its own.
--
-- The website never writes to this table directly. It POSTs to the ERP's public endpoint
-- (/api/public/web-leads), which validates, rate-limits and inserts with the service role.
-- RLS therefore grants the anon role NOTHING (no policy = deny); only the marketing roles
-- (via web_can_edit(), migrations 118 + 120) may read/write from a signed-in client.
-- Idempotent: safe to run more than once.

create table if not exists public.web_leads (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null default 'contact' check (kind in ('contact', 'newsletter')),
  name                 text,
  phone                text,
  email                text,
  company              text,
  store_location       text,
  store_condition      text,                 -- as sent: 'New Store' | 'Remodeling'
  store_type           text,                 -- as sent: 'C-store' | 'Truck Stop' | 'Grocery' | 'Other'
  message              text,
  consent_accepted     boolean not null default false,
  consent_text_version text,
  consent_at           timestamptz,
  source_page          text,                 -- page the form was on (optional, sent by the site)
  utm                  jsonb,                -- utm_* parameters (optional, sent by the site)
  ip_hash              text,                 -- SHA-256 of the IP, abuse tracing only — never the raw IP
  status               text not null default 'new' check (status in ('new', 'contacted', 'converted', 'spam', 'archived')),
  internal_note        text,
  prospect_id          uuid references public.prospects(id) on delete set null,
  handled_by           uuid references public.profiles(id) on delete set null,
  handled_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists web_leads_status_created_idx on public.web_leads(status, created_at desc);
create index if not exists web_leads_email_idx          on public.web_leads(lower(email));

drop trigger if exists web_leads_touch on public.web_leads;
create trigger web_leads_touch before update on public.web_leads
  for each row execute function public.web_touch_updated_at();

alter table public.web_leads enable row level security;

-- Marketing roles only. The ERP API layer (service role) is the real gate; this is the second line.
drop policy if exists "web_leads marketing" on public.web_leads;
create policy "web_leads marketing" on public.web_leads
  for all using (public.web_can_edit()) with check (public.web_can_edit());
