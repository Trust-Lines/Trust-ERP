-- 084_ops_manager_marketing_write.sql — 2026-08-11
--
-- ops_manager was excluded from Marketing WRITE authority on purpose back in migration
-- 072 (PHASE-00-...md §00.3 said ops_manager should be read-only oversight in Marketing).
-- In practice this contradicted CLAUDE.md's "ops_manager = full Trust-Lines operational
-- authority" and surprised an actual ops_manager user, who couldn't find "Add Lead" in
-- Lead Cloud. Explicit user decision: widen it — ops_manager now has the same Marketing
-- write authority as general_manager. Mirrors the app-layer change in
-- lib/marketing/roles.ts (MARKETING_MANAGE_ROLES / MARKETING_WRITE_ROLES now include
-- ops_manager) — this migration is the RLS side of that (defense-in-depth; the real gate
-- is the service-role API layer's requireRole(MARKETING_WRITE_ROLES) checks).
--
-- Idempotent: every policy is DROP-then-CREATE, matching this repo's standard pattern.

DROP POLICY IF EXISTS prospects_write_manage ON prospects;
CREATE POLICY prospects_write_manage ON prospects
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
  );

DROP POLICY IF EXISTS prospect_contacts_write ON prospect_contacts;
CREATE POLICY prospect_contacts_write ON prospect_contacts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_contacts.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_contacts.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_locations_write ON prospect_locations;
CREATE POLICY prospect_locations_write ON prospect_locations
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_locations.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_locations.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_needs_write ON prospect_needs;
CREATE POLICY prospect_needs_write ON prospect_needs
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_needs.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_needs.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prospect_potentials_write ON prospect_potentials;
CREATE POLICY prospect_potentials_write ON prospect_potentials
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_potentials.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager'))
    OR EXISTS (
      SELECT 1 FROM prospects pr
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'marketing_pr'
      WHERE pr.id = prospect_potentials.prospect_id
        AND (pr.created_by = auth.uid() OR pr.assigned_marketing_user_id = auth.uid() OR pr.owner_id = auth.uid())
    )
  );
