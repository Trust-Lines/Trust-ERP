-- Items Library: the order cards are dragged into ("My order"). Null = never placed; those come
-- first, newest first.

alter table public.it_items add column if not exists position integer;

notify pgrst, 'reload schema';
