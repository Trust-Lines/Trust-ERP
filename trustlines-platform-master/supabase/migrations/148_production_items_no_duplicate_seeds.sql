-- production_items: one placeholder row per project + type.
--
-- The production board and /api/production/items create a vendor-less row per type when a project
-- has none. Two requests at the same moment both saw "none" and both inserted, so on 2026-11-10
-- 08:54 every open project got each type twice (the cockpit listed Millwork, Ceiling… twice and
-- "10 types without a vendor"). Nothing in the database stopped it.
--
-- 1. Soft-delete the extra copies (deleted_at, reversible). Per project + type, among the
--    vendor-less rows, the one with data is kept (status moved, dates, PF, notes…), else the
--    oldest; a row someone has written to is never touched.
-- 2. A partial unique index so the race can't happen again; the seeding code ignores the
--    resulting conflict (another request already seeded).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY project_id, type
           ORDER BY (status <> 'NOT_ORDERED' OR pf_code IS NOT NULL OR std IS NOT NULL OR etd IS NOT NULL
                     OR rtd IS NOT NULL OR rtr IS NOT NULL OR rdy IS NOT NULL OR ftd IS NOT NULL OR snd IS NOT NULL
                     OR container_no IS NOT NULL OR hold_note IS NOT NULL OR assigned_to IS NOT NULL
                     OR start_date IS NOT NULL OR target_date IS NOT NULL OR COALESCE(pf_usd, 0) <> 0) DESC,
                    created_at ASC
         ) AS rn,
         (status <> 'NOT_ORDERED' OR pf_code IS NOT NULL OR std IS NOT NULL OR etd IS NOT NULL
          OR rtd IS NOT NULL OR rtr IS NOT NULL OR rdy IS NOT NULL OR ftd IS NOT NULL OR snd IS NOT NULL
          OR container_no IS NOT NULL OR hold_note IS NOT NULL OR assigned_to IS NOT NULL
          OR start_date IS NOT NULL OR target_date IS NOT NULL OR COALESCE(pf_usd, 0) <> 0) AS touched
  FROM production_items
  WHERE source = 'project' AND vendor_id IS NULL AND deleted_at IS NULL
)
UPDATE production_items p
SET deleted_at = now()
FROM ranked r
WHERE p.id = r.id AND r.rn > 1 AND NOT r.touched;

-- If two touched vendor-less rows of one type remain, the index can't be built; they are left for
-- a person to merge (none existed when this was written).
CREATE UNIQUE INDEX IF NOT EXISTS production_items_one_seed_per_type
  ON production_items (project_id, type)
  WHERE source = 'project' AND vendor_id IS NULL AND deleted_at IS NULL;
