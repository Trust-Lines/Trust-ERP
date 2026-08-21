-- 101_lead_tasks_potential_anchor.sql — 2026-08-14
--
-- User asked for the same ClickUp "Add subtask" hover UI (add/edit icons on hover,
-- inline add row, expandable nested subtask rows with checkbox+assignee) on Potential
-- rows too, not just Opportunity/lead_intake ones. `lead_tasks` (migration 041/081)
-- already dual-anchors lead_intake/opportunity — this adds a third anchor,
-- `potential_id`, the same way 081 added `opportunity_id` onto the original
-- lead_intake-only table.

ALTER TABLE lead_tasks ADD COLUMN IF NOT EXISTS potential_id UUID REFERENCES prospect_potentials(id) ON DELETE CASCADE;

ALTER TABLE lead_tasks DROP CONSTRAINT IF EXISTS lead_tasks_one_anchor_check;
ALTER TABLE lead_tasks ADD CONSTRAINT lead_tasks_one_anchor_check CHECK (
  (CASE WHEN lead_intake_id IS NOT NULL THEN 1 ELSE 0 END
 + CASE WHEN opportunity_id IS NOT NULL THEN 1 ELSE 0 END
 + CASE WHEN potential_id  IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_potential ON lead_tasks(potential_id) WHERE potential_id IS NOT NULL;

DROP POLICY IF EXISTS lead_tasks_sales_rw ON lead_tasks;
CREATE POLICY lead_tasks_sales_rw ON lead_tasks
  FOR ALL
  USING (
    (lead_intake_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM lead_intake li WHERE li.id = lead_intake_id
      AND (li.created_by = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager'))
    ))
    OR (opportunity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM opportunities o WHERE o.id = opportunity_id
      AND (o.sales_owner_id = auth.uid() OR o.marketing_owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                      AND p.role IN ('sales_marketing_manager','marketing_manager','ops_manager','general_manager')))
    ))
    OR (potential_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM prospect_potentials pp WHERE pp.id = potential_id
      AND (pp.assigned_to = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                      AND p.role IN ('sales_rep','sales_marketing_manager','marketing_manager','ops_manager','general_manager')))
    ))
  )
  WITH CHECK (
    (lead_intake_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM lead_intake li WHERE li.id = lead_intake_id
      AND (li.created_by = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'sales_marketing_manager'))
    ))
    OR (opportunity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM opportunities o WHERE o.id = opportunity_id
      AND (o.sales_owner_id = auth.uid() OR o.marketing_owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                      AND p.role IN ('sales_marketing_manager','marketing_manager','ops_manager','general_manager')))
    ))
    OR (potential_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM prospect_potentials pp WHERE pp.id = potential_id
      AND (pp.assigned_to = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                      AND p.role IN ('sales_rep','sales_marketing_manager','marketing_manager','ops_manager','general_manager')))
    ))
  );
