-- 044_lead_intake_opp_status_expand.sql
-- Expand the Leads pipeline to the full 7 stages shown on the board. Migration 032
-- only allowed 4; this adds the three missing middle/late stages and keeps the CHECK
-- in sync with STATUS_ORDER in components/platform/leads/types.ts.
--
-- New values: working_on_it_trust, design_proposal_sent, contract_stage.
-- Order (UI): new_opportunity → ready_to_start → modification_request →
--             working_on_it_trust → design_proposal_sent → waiting_from_op → contract_stage.
-- Existing rows are unaffected (their values are all still in the list).

ALTER TABLE lead_intake DROP CONSTRAINT IF EXISTS lead_intake_opp_status_check;
ALTER TABLE lead_intake ADD CONSTRAINT lead_intake_opp_status_check
  CHECK (opportunity_status IN (
    'new_opportunity',
    'ready_to_start',
    'modification_request',
    'working_on_it_trust',
    'design_proposal_sent',
    'waiting_from_op',
    'contract_stage'
  ));
