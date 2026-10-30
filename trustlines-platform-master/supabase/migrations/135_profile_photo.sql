-- 135: Profile photo — Settings → Profile. The image itself lives in Dropbox
-- (/Team/Profile Photos/<user id>.jpg, one per person, overwritten on change); this only
-- remembers where, and when it last changed (cache-busting for /api/avatar/<id>).
--
-- Additive only: two nullable columns. Safe to run more than once.

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists avatar_updated_at timestamptz;
