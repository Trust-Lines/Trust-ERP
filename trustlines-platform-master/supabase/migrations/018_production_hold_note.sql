-- 018_production_hold_note.sql
-- HOLD / T reason for a production row, set from the PO page when an order is held,
-- plus the status the row had BEFORE the hold so Release restores it (never forces
-- ORDERED — the real status is chosen from the PF page).

ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS hold_note TEXT;

ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS pre_hold_status TEXT;
