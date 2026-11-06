-- 141: Website lead emails — who gets them and which mailbox sends them (Settings → Website leads).
--
-- One row (id = true). recipients: the addresses every new website submission is emailed to.
-- The sender mailbox (e.g. info@t-lines.us on Purelymail) is optional; without it the app's
-- default SMTP_* account sends. smtp_pass_enc is AES-256-GCM encrypted with APP_ENCRYPTION_KEY
-- (lib/crypto/secrets.ts), never stored in plain text.
--
-- Not in web_settings on purpose: that table is publicly readable by the website.
-- RLS on with no policies — only the service-role API routes touch it (117 pattern).
-- Additive only. Safe to run more than once.

create table if not exists public.web_lead_mail_settings (
  id             boolean primary key default true check (id),
  recipients     text[]  not null default '{}',
  from_name      text,
  from_email     text,
  smtp_host      text,
  smtp_port      integer,
  smtp_secure    boolean not null default true,
  smtp_user      text,
  smtp_pass_enc  text,
  verified_at    timestamptz,
  last_error     text,
  updated_by     uuid references public.profiles(id) on delete set null,
  updated_at     timestamptz not null default now()
);

alter table public.web_lead_mail_settings enable row level security;
