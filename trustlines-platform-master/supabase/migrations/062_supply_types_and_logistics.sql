-- 062_supply_types_and_logistics.sql
-- Phase 4 (Project Types) + Phase 7 tail (Container documents / Direct job site).
--
--   * production_items type-management columns — the per-project×type row (source='project')
--     IS the "project type" entity from §4.5. It already carries vendor/PF/PO/status/dates;
--     this adds the missing management fields (owner, priority, start/target date) so each
--     type has its own owner + schedule + sub-status, surfaced on the /projects/[id]/types board.
--   * containers.delivery_destination — warehouse vs direct job site (+ job_site_address).
--   * container_documents — files attached to a container (BL, packing list, customs…),
--     metadata + Dropbox pointer (immutable store), same RLS boundary as containers.
--
-- Additive & re-runnable; RLS unchanged for production_items (already covered by 014).

-- ── Phase 4: production_items as the type entity ──────────────
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS priority    TEXT;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS start_date  DATE;
ALTER TABLE production_items ADD COLUMN IF NOT EXISTS target_date DATE;

ALTER TABLE production_items DROP CONSTRAINT IF EXISTS production_items_priority_check;
ALTER TABLE production_items ADD CONSTRAINT production_items_priority_check
  CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_production_items_assigned ON production_items(assigned_to) WHERE deleted_at IS NULL;

-- ── Phase 7: container delivery destination ───────────────────
ALTER TABLE containers ADD COLUMN IF NOT EXISTS delivery_destination TEXT NOT NULL DEFAULT 'warehouse';
ALTER TABLE containers ADD COLUMN IF NOT EXISTS job_site_address     TEXT;

ALTER TABLE containers DROP CONSTRAINT IF EXISTS containers_delivery_dest_check;
ALTER TABLE containers ADD CONSTRAINT containers_delivery_dest_check
  CHECK (delivery_destination IN ('warehouse', 'direct_job_site'));

-- ── Phase 3: PM follow-up reminder dedup ──────────────────────
-- customer_follow_ups already carries due_date + assignee_id; this column dedupes
-- the reminder notification so an overdue follow-up alerts its owner once per due date.
ALTER TABLE customer_follow_ups ADD COLUMN IF NOT EXISTS reminded_on DATE;

-- ── Phase 7: container documents ──────────────────────────────
CREATE TABLE IF NOT EXISTS container_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  doc_type     TEXT,                    -- bill_of_lading | packing_list | customs | invoice | other
  name         TEXT NOT NULL,
  dropbox_path TEXT,
  url          TEXT,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cdoc_container ON container_documents(container_id) WHERE deleted_at IS NULL;

ALTER TABLE container_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS container_documents_read ON container_documents;
CREATE POLICY container_documents_read ON container_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','tlines_pm',
                           'logistics','accounting','qc_responsible','pm_millwork','pm_ceiling'))
  );
DROP POLICY IF EXISTS container_documents_write ON container_documents;
CREATE POLICY container_documents_write ON container_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','logistics'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('ops_manager','general_manager','trustlines_pm','logistics'))
  );
