-- 081_crm_bridge_tasks_activity_watchers.sql — CRM unification, phase 1.
--
-- lead_tasks / lead_activity / lead_watchers (the ClickUp-style subtask/comment/
-- follow tooling, migrations 037/039/041/042) were lead_intake-only. The newer
-- Marketing→Opportunity pipeline (072-078) has zero task/activity/watcher support —
-- an Opportunity-sourced deal gets NONE of this tooling today. User decision
-- (2026-08-06): bridge both trees, keep both live — the exact dual-anchor pattern
-- already proven in 079_phase00_design_opportunity_bridge.sql, extended to these
-- three tables.

-- ── lead_tasks ────────────────────────────────────────────────────────────────
ALTER TABLE lead_tasks ALTER COLUMN lead_intake_id DROP NOT NULL;
ALTER TABLE lead_tasks ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE;
ALTER TABLE lead_tasks DROP CONSTRAINT IF EXISTS lead_tasks_one_anchor_check;
ALTER TABLE lead_tasks ADD CONSTRAINT lead_tasks_one_anchor_check
  CHECK ((lead_intake_id IS NOT NULL) <> (opportunity_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_lead_tasks_opportunity ON lead_tasks(opportunity_id) WHERE opportunity_id IS NOT NULL;

-- ── lead_activity ─────────────────────────────────────────────────────────────
ALTER TABLE lead_activity ALTER COLUMN lead_intake_id DROP NOT NULL;
ALTER TABLE lead_activity ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE;
ALTER TABLE lead_activity DROP CONSTRAINT IF EXISTS lead_activity_one_anchor_check;
ALTER TABLE lead_activity ADD CONSTRAINT lead_activity_one_anchor_check
  CHECK ((lead_intake_id IS NOT NULL) <> (opportunity_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_lead_activity_opportunity ON lead_activity(opportunity_id, created_at DESC) WHERE opportunity_id IS NOT NULL;

-- ── lead_watchers ─────────────────────────────────────────────────────────────
-- The composite PK (lead_intake_id, user_id) can't survive lead_intake_id going
-- nullable — an opportunity-anchored row would have lead_intake_id NULL, and
-- Postgres allows only one NULL-containing "duplicate" per unique constraint
-- anyway (NULLs are not equal to each other), which would silently let a user
-- watch the SAME opportunity twice. Replace with a surrogate id + two partial
-- unique indexes, exactly mirroring 079's idx_sdj_one_per_lead/opportunity split.
ALTER TABLE lead_watchers ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE lead_watchers SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE lead_watchers ALTER COLUMN id SET NOT NULL;

ALTER TABLE lead_watchers DROP CONSTRAINT IF EXISTS lead_watchers_pkey;
ALTER TABLE lead_watchers ADD CONSTRAINT lead_watchers_pkey PRIMARY KEY (id);

ALTER TABLE lead_watchers ALTER COLUMN lead_intake_id DROP NOT NULL;
ALTER TABLE lead_watchers ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE;
ALTER TABLE lead_watchers DROP CONSTRAINT IF EXISTS lead_watchers_one_anchor_check;
ALTER TABLE lead_watchers ADD CONSTRAINT lead_watchers_one_anchor_check
  CHECK ((lead_intake_id IS NOT NULL) <> (opportunity_id IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_watchers_one_per_lead
  ON lead_watchers(lead_intake_id, user_id) WHERE lead_intake_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_watchers_one_per_opportunity
  ON lead_watchers(opportunity_id, user_id) WHERE opportunity_id IS NOT NULL;

-- ── RLS — a real branch is needed here (unlike 079's sales_design_jobs, whose
-- policies were already pure role-based). All three existing policies EXISTS-join
-- lead_intake only; add an opportunities-side OR branch so an opportunity-anchored
-- row isn't silently invisible under RLS (service-role API routes bypass RLS
-- entirely via the new canAccessOpportunity() gate — this is defense-in-depth).
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
  );

DROP POLICY IF EXISTS lead_activity_sales_rw ON lead_activity;
CREATE POLICY lead_activity_sales_rw ON lead_activity
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
  );

DROP POLICY IF EXISTS lead_watchers_rw ON lead_watchers;
CREATE POLICY lead_watchers_rw ON lead_watchers
  FOR ALL
  USING (
    user_id = auth.uid()
    OR (lead_intake_id IS NOT NULL AND EXISTS (
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
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (lead_intake_id IS NOT NULL AND EXISTS (
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
  );
