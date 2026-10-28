-- 132: Design workspace — each design job remembers its own Dropbox design folder.
--
-- Until now the folder was derived from the Project (/D-Projects/... → /Design/...), so a job had
-- no folder before Accept created the Project. A job now gets its folder the moment design work
-- starts: the Project's design folder when there is one, otherwise /Design/Pre-Project/<job>.
-- The path is stored so it never moves (nothing in Dropbox is ever relocated by the app), plus
-- the shared link Sales opens from the CRM.
--
-- Additive only: two nullable columns, no data rewritten. Safe to run more than once.

alter table public.sales_design_jobs add column if not exists dropbox_folder_path text;
alter table public.sales_design_jobs add column if not exists dropbox_shared_url  text;

comment on column public.sales_design_jobs.dropbox_folder_path is
  'Dropbox design folder of this job (set when design work starts; never moved).';
comment on column public.sales_design_jobs.dropbox_shared_url is
  'Dropbox shared link to dropbox_folder_path — what Sales opens from the CRM.';
