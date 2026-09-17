-- 115_marketing_campaigns_visible_to_all_pr.sql — 2026-09-17
--
-- marketing_campaigns_read (086) only let a marketing_pr see campaigns they personally
-- owned/created — same restriction Contacts had until 108/109 removed it ("a marketing_pr
-- should see everything Marketing has, not just their own rows"). Found live: the Campaigns
-- & Surveys page showed completely empty for the real marketing_pr account, because every
-- existing campaign was created by a different (admin/general_manager) account. Write access
-- stays exactly as it was — marketing_pr can still only edit/delete campaigns they own or
-- created (marketing_campaigns_write_own, unchanged); this only widens what they can *see*.

DROP POLICY IF EXISTS marketing_campaigns_read ON marketing_campaigns;
CREATE POLICY marketing_campaigns_read ON marketing_campaigns
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager', 'marketing_pr'))
  );

-- Same ownership restriction existed one level down too — a marketing_pr could now see a
-- campaign but its submission count / interaction rows would still silently read as zero.
DROP POLICY IF EXISTS survey_submissions_read ON survey_submissions;
CREATE POLICY survey_submissions_read ON survey_submissions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager', 'marketing_pr'))
  );

DROP POLICY IF EXISTS campaign_interactions_read ON campaign_interactions;
CREATE POLICY campaign_interactions_read ON campaign_interactions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing_manager', 'general_manager', 'ops_manager', 'marketing_pr'))
  );
