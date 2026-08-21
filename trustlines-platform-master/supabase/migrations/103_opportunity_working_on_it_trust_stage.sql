-- 103_opportunity_working_on_it_trust_stage.sql (2026-08-19)
-- ClickUp's real "WORKING ON IT TRUST" Status OP value (confirmed live on the
-- "Opportunities SE" list) had no matching `opportunities.stage` — unmapped Status OP
-- values silently fall back to 'potential' in lib/clickup/importOpportunitiesMapping.ts,
-- so these rows were dropped entirely rather than imported. User wants exact ClickUp
-- parity ("clickupta neyse o gelmeli") — additive only, no existing stage renamed/removed.

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;
ALTER TABLE opportunities ADD  CONSTRAINT opportunities_stage_check
  CHECK (stage IN (
    'new','marketing_qualification','qualified_for_sales','sales_handoff','sales_accepted',
    'discovery','sales_design','proposal','negotiation','closed_won','closed_lost','on_hold',
    'working_on_it_trust'
  ));
