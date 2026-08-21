import { describe, it, expect } from 'vitest';
import { STAGE_TO_STATUS, STATUS_TO_STAGE, loadOpportunityLeadRows } from '@/lib/marketing/opportunityRows';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import { STATUS_ORDER } from '@/components/platform/leads/types';
import { mapStatusOp } from '@/lib/clickup/importOpportunitiesMapping';
import type { OpportunityStage } from '@/types/database';

describe('STAGE_TO_STATUS — every OpportunityStage maps to a real board bucket', () => {
  it('covers every stage in OPPORTUNITY_STAGE_LABEL', () => {
    const stages = Object.keys(OPPORTUNITY_STAGE_LABEL) as OpportunityStage[];
    const bucketKeys = new Set(STATUS_ORDER.map(s => s.key));
    for (const stage of stages) {
      expect(STAGE_TO_STATUS[stage], `stage "${stage}" has no bucket`).toBeDefined();
      expect(bucketKeys.has(STAGE_TO_STATUS[stage])).toBe(true);
    }
  });

  it('closed_won/closed_lost/on_hold get their OWN real buckets — never collapsed together', () => {
    expect(STAGE_TO_STATUS.closed_won).toBe('deal_closed');
    expect(STAGE_TO_STATUS.closed_lost).toBe('deal_missed');
    expect(STAGE_TO_STATUS.on_hold).toBe('waiting');
    const buckets = new Set([STAGE_TO_STATUS.closed_won, STAGE_TO_STATUS.closed_lost, STAGE_TO_STATUS.on_hold]);
    expect(buckets.size).toBe(3);
  });

  it('negotiation (real ClickUp "MODIFICATION REQUEST") maps to modification_request, not contract_stage', () => {
    expect(STAGE_TO_STATUS.negotiation).toBe('modification_request');
  });
});

describe('cross-check: /leads board bucket agrees with the ClickUp import mapping', () => {
  const REAL_STATUS_OP_VALUES = ['READY TO START', 'MODIFICATION REQUEST', 'Design Proposal SENT', 'WAITING', 'DEAL MISSED', 'DEAL CLOSED'];

  it('every real Status OP value\'s imported stage lands in the SAME /leads bucket, regardless of which file computed it', () => {
    for (const raw of REAL_STATUS_OP_VALUES) {
      const outcome = mapStatusOp(raw);
      expect(outcome.kind, `"${raw}" unexpectedly mapped to 'potential'`).toBe('opportunity');
      if (outcome.kind === 'opportunity') {
        expect(STAGE_TO_STATUS[outcome.stage], `"${raw}" → stage "${outcome.stage}" has no /leads bucket`).toBeDefined();
      }
    }
  });
});

describe('STATUS_TO_STAGE — reverse mapping used by manual drag-and-drop', () => {
  it('working_on_it_trust/waiting_from_op/contract_stage have no real Opportunity-side stage anymore (Sales-only buckets — drop must be rejected, not silently mapped)', () => {
    expect(STATUS_TO_STAGE.working_on_it_trust).toBeNull();
    expect(STATUS_TO_STAGE.waiting_from_op).toBeNull();
    expect(STATUS_TO_STAGE.contract_stage).toBeNull();
  });

  it('every non-null reverse mapping round-trips back to the SAME bucket it came from', () => {
    for (const [status, stage] of Object.entries(STATUS_TO_STAGE)) {
      if (stage === null) continue;
      expect(STAGE_TO_STATUS[stage]).toBe(status);
    }
  });
});

function fakeSb(tables: Record<string, unknown[]>) {
  function chain(table: string) {
    const rows = tables[table] ?? [];
    const thenable: any = {
      select: () => thenable, is: () => thenable, order: () => thenable, limit: () => thenable,
      in: () => thenable, eq: () => thenable,
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return thenable;
  }
  return { from: (t: string) => chain(t) } as any;
}

const baseOpp = {
  id: 'opp-1', prospect_id: 'p1', project_id: null, primary_contact_id: null,
  title: 'Test Deal', project_types: [], stage: 'negotiation', priority: 'high',
  source_label: 'Referral', marketing_owner_id: null, sales_owner_id: 'u1',
  estimated_value: 50000, next_action: 'Follow up', next_action_date: null,
  created_at: '2026-08-01T00:00:00Z', closed_at: null, region: 'TLINES_NE',
};

describe('loadOpportunityLeadRows', () => {
  it('maps an open Opportunity to an un-archived Lead row with origin "opportunity"', async () => {
    const sb = fakeSb({
      opportunities: [baseOpp],
      prospects: [{ id: 'p1', display_name: 'ZZTEST Acme', industry: 'Retail', brand_name: 'Acme' }],
      prospect_locations: [{ prospect_id: 'p1', city: 'Austin', state: 'TX' }],
      profiles: [{ id: 'u1', full_name: 'Sam Sales' }],
      prospect_contacts: [],
      projects: [],
      lead_tasks: [],
    });

    const rows = await loadOpportunityLeadRows(sb);

    expect(rows).toHaveLength(1);
    expect(rows[0].origin).toBe('opportunity');
    expect(rows[0].name).toBe('ZZTEST Acme');
    expect(rows[0].opportunity_status).toBe('modification_request');
    expect(rows[0].archived).toBe(false);
    expect(rows[0].location).toBe('Austin, TX');
    expect(rows[0].assignee).toBe('Sam Sales');
    expect(rows[0].region).toBe('TLINES_NE');
  });

  it('a closed_won Opportunity gets its own visible "deal_closed" bucket — NOT archived (2026-08-13 fix: this used to hide it)', async () => {
    const sb = fakeSb({
      opportunities: [{ ...baseOpp, stage: 'closed_won', closed_at: '2026-08-05T00:00:00Z' }],
      prospects: [{ id: 'p1', display_name: 'ZZTEST Acme', industry: null, brand_name: null }],
      prospect_locations: [],
      profiles: [],
      prospect_contacts: [],
      projects: [],
      lead_tasks: [],
    });

    const rows = await loadOpportunityLeadRows(sb);

    expect(rows[0].opportunity_status).toBe('deal_closed');
    expect(rows[0].archived).toBe(false);
    expect(rows[0].date_done).toBe('2026-08-05T00:00:00Z');
  });
});
