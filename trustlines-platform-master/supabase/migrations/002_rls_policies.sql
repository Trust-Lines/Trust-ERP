-- ─────────────────────────────────────────────────────────────
-- Migration 002: Row-Level Security Policies
-- ─────────────────────────────────────────────────────────────

ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_checklists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_approvals ENABLE ROW LEVEL SECURITY;

-- ── HELPER FUNCTIONS ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_internal_role()
RETURNS BOOLEAN AS $$
  SELECT auth_role() IN (
    'ops_manager','executive','pm_millwork','pm_ceiling',
    'trustlines_pm','qc_responsible','logistics','accounting'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── PROJECTS ──────────────────────────────────────────────────

-- ops_manager and executive see everything
CREATE POLICY "ops_exec_all"
  ON projects FOR SELECT
  USING (auth_role() IN ('ops_manager','executive'));

-- tlines_pm sees only their own projects
CREATE POLICY "tlines_own"
  ON projects FOR SELECT
  USING (auth_role() = 'tlines_pm' AND tlines_pm_id = auth.uid());

-- pm_millwork sees millwork/shelving projects only
CREATE POLICY "pm_ms_scoped"
  ON projects FOR SELECT
  USING (auth_role() = 'pm_millwork' AND has_millwork_shelving = TRUE);

-- pm_ceiling sees ceiling/image projects only
CREATE POLICY "pm_ci_scoped"
  ON projects FOR SELECT
  USING (auth_role() = 'pm_ceiling' AND has_ceiling_image = TRUE);

-- logistics sees packing/shipment/delivered stages
CREATE POLICY "logistics_stages"
  ON projects FOR SELECT
  USING (
    auth_role() = 'logistics'
    AND current_stage IN ('packing','shipment','delivered')
  );

-- accounting sees financial stages
CREATE POLICY "accounting_stages"
  ON projects FOR SELECT
  USING (
    auth_role() = 'accounting'
    AND current_stage IN (
      'po_bo_create','po_bo_signed','pf_draft','pf_signed',
      'production','qc','packing','shipment','delivered'
    )
  );

-- trustlines_pm sees all projects
CREATE POLICY "trustlines_pm_all"
  ON projects FOR SELECT
  USING (auth_role() = 'trustlines_pm');

-- qc_responsible sees production/qc stages
CREATE POLICY "qc_responsible_stages"
  ON projects FOR SELECT
  USING (
    auth_role() = 'qc_responsible'
    AND current_stage IN ('production','qc','packing')
  );

CREATE POLICY "ops_create"
  ON projects FOR INSERT
  WITH CHECK (auth_role() = 'ops_manager');

CREATE POLICY "ops_exec_update"
  ON projects FOR UPDATE
  USING (auth_role() IN ('ops_manager','executive'));

-- ── DOCUMENTS ─────────────────────────────────────────────────

-- Internal roles see all documents
CREATE POLICY "internal_docs"
  ON documents FOR SELECT
  USING (is_internal_role() = TRUE);

-- tlines_pm sees docs on their projects but NEVER pf docs
CREATE POLICY "tlines_no_pf"
  ON documents FOR SELECT
  USING (
    auth_role() = 'tlines_pm'
    AND doc_type != 'pf'
    AND project_id IN (
      SELECT id FROM projects WHERE tlines_pm_id = auth.uid()
    )
  );

CREATE POLICY "internal_insert_docs"
  ON documents FOR INSERT
  WITH CHECK (is_internal_role() = TRUE);

CREATE POLICY "internal_update_docs"
  ON documents FOR UPDATE
  USING (is_internal_role() = TRUE);

-- ── SUPPLIERS ─────────────────────────────────────────────────
CREATE POLICY "internal_suppliers"
  ON suppliers FOR ALL
  USING (is_internal_role() = TRUE);

-- ── AUDIT LOG ─────────────────────────────────────────────────
CREATE POLICY "own_audit"
  ON audit_log FOR SELECT
  USING (actor_id = auth.uid());

CREATE POLICY "ops_exec_audit"
  ON audit_log FOR SELECT
  USING (auth_role() IN ('ops_manager','executive'));

CREATE POLICY "internal_insert_audit"
  ON audit_log FOR INSERT
  WITH CHECK (TRUE);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE POLICY "own_notifications"
  ON notifications FOR ALL
  USING (user_id = auth.uid());

-- ── PROJECT NOTES ─────────────────────────────────────────────
CREATE POLICY "internal_notes"
  ON project_notes FOR ALL
  USING (is_internal_role() = TRUE);

-- ── QC CHECKLISTS ─────────────────────────────────────────────
CREATE POLICY "internal_qc"
  ON qc_checklists FOR ALL
  USING (is_internal_role() = TRUE);

-- ── STAGE TRANSITIONS ─────────────────────────────────────────
CREATE POLICY "internal_transitions"
  ON stage_transitions FOR ALL
  USING (is_internal_role() = TRUE);

-- ── DOCUMENT APPROVALS ────────────────────────────────────────
CREATE POLICY "internal_approvals"
  ON document_approvals FOR ALL
  USING (is_internal_role() = TRUE);

CREATE POLICY "tlines_approvals"
  ON document_approvals FOR SELECT
  USING (
    auth_role() = 'tlines_pm'
    AND project_id IN (
      SELECT id FROM projects WHERE tlines_pm_id = auth.uid()
    )
  );
