-- 163: a phone line ↔ the company phone it runs on, from the Items Library.
--
-- Adding a phone in Items Library with a number creates (or links) its line in Phone Numbers; on the
-- line, "Company phone" can pick the phone from the library. Each page links to the other.
-- One line per phone (the unique index); a deleted line frees its phone. device_name stays as the
-- text snapshot (the item's name) so lists and history read the same as before.
-- Additive only; safe to run more than once. RLS is already on with no policies (158).

alter table public.it_phone_lines add column if not exists item_id uuid references public.it_items(id) on delete set null;

create unique index if not exists it_phone_lines_item_idx on public.it_phone_lines (item_id)
  where item_id is not null and deleted_at is null;
