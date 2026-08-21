-- 093_checklist_order_index_numeric.sql — 2026-08-13
--
-- migration 092's prospect_contact_checklist_items.order_index was INT, but ClickUp
-- assigns FRACTIONAL orderindex values to checklist items that were drag-reordered
-- (e.g. "1.5") — the backfill script hit "invalid input syntax for type integer: 1.5" on
-- a real NE contact. Widen to NUMERIC; no data loss, table only has partial data so far.

ALTER TABLE prospect_contact_checklist_items ALTER COLUMN order_index TYPE NUMERIC USING order_index::numeric;
