-- IT items held by someone with no account yet: a typed holder name (like it_phone_lines.holder_name).
-- An assigned item has assignee_id OR holder_name, never both.
--
-- A company phone takes its holder from its line in Phone Numbers (it_phone_lines.item_id): this
-- backfills the phones whose line already has a holder but which still show as Available, and opens
-- their assignment history.

alter table public.it_items add column if not exists holder_name text;

do $$ begin
  alter table public.it_items add constraint it_items_holder_name_len
    check (holder_name is null or char_length(trim(holder_name)) between 1 and 120);
exception when duplicate_object then null; end $$;

with moved as (
  update public.it_items i
  set status      = 'assigned',
      assignee_id = l.holder_id,
      holder_name = case when l.holder_id is null then trim(l.holder_name) end,
      assigned_at = coalesce(l.holder_since::timestamptz, now()),
      updated_at  = now()
  from public.it_phone_lines l
  where l.item_id = i.id
    and l.deleted_at is null
    and l.retired_at is null
    and i.deleted_at is null
    and i.status = 'available'
    and (l.holder_id is not null or nullif(trim(l.holder_name), '') is not null)
  returning i.id, i.assignee_id, i.holder_name, i.assigned_at
)
insert into public.it_assignments (asset_kind, asset_id, person_id, person_name, started_at)
select 'item', m.id, m.assignee_id, m.holder_name, m.assigned_at
from moved m
where not exists (
  select 1 from public.it_assignments a where a.asset_kind = 'item' and a.asset_id = m.id and a.ended_at is null
);

notify pgrst, 'reload schema';
