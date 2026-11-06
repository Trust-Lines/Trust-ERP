-- 140: Website Leads — separate "Notes" field from the website contact form.
--
-- The site's form now has a Notes box next to Message. It used to be read only as a fallback
-- for message (so when both were sent, the note was dropped). It gets its own column now.
--
-- Additive only. Safe to run more than once.

alter table public.web_leads add column if not exists notes text;
