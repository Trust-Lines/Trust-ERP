import { describe, it, expect, vi } from 'vitest';
import { ensureDesignJobForOpportunity, syncOpportunityStageFromDesignJob } from '@/lib/marketing/design';

vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('@/lib/sales/design', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sales/design')>();
  return { ...actual, ensureDesignDropboxFolder: vi.fn(async () => {}) };
});

function makeFakeAdmin(seed: { sales_design_jobs?: any[]; opportunities?: any[] } = {}) {
  const db: Record<string, any[]> = {
    sales_design_jobs: seed.sales_design_jobs ?? [], opportunities: seed.opportunities ?? [],
  };
  let idCounter = 1;

  function from(table: string) {
    const rows = db[table];
    let filtered = rows;
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;

    const builder: any = {
      select: () => builder,
      eq: (f: string, v: unknown) => { filtered = filtered.filter(r => r[f] === v); return builder; },
      is: (f: string, v: unknown) => { filtered = filtered.filter(r => (v === null ? r[f] == null : r[f] === v)); return builder; },
      insert: (row: Record<string, unknown>) => {
        if (table === 'sales_design_jobs' && row.opportunity_id
          && rows.some(r => r.opportunity_id === row.opportunity_id && r.deleted_at == null)) {
          pendingInsert = null;
          return { ...builder, select: () => ({ single: async () => ({ data: null, error: { code: '23505', message: 'duplicate' } }) }) };
        }
        pendingInsert = { id: `${table}-${idCounter++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
        return builder;
      },
      update: (patch: Record<string, unknown>) => { pendingUpdate = patch; return builder; },
      maybeSingle: async () => {
        if (pendingInsert) { rows.push(pendingInsert); return { data: pendingInsert, error: null }; }
        if (pendingUpdate) { const t = filtered[0]; if (t) Object.assign(t, pendingUpdate); return { data: t ?? null, error: null }; }
        return { data: filtered[0] ?? null, error: null };
      },
      single: async () => builder.maybeSingle(),
      then: (resolve: (v: { data: unknown; error: null }) => void) => { builder.maybeSingle().then(resolve); },
    };
    return builder;
  }

  return { admin: { from } as any, db };
}

const baseOpp = { id: 'o1', title: 'ZZTEST Opp', prospect_id: 'p1', project_id: 'proj1', stage: 'sales_accepted' };

describe('ensureDesignJobForOpportunity', () => {
  it('creates exactly one job and advances the Opportunity to discovery', async () => {
    const { admin, db } = makeFakeAdmin({ opportunities: [{ ...baseOpp }] });
    const result = await ensureDesignJobForOpportunity(admin, 'o1', 'u1');
    expect(result.created).toBe(true);
    expect(db.sales_design_jobs).toHaveLength(1);
    expect(db.sales_design_jobs[0].opportunity_id).toBe('o1');
    expect(db.sales_design_jobs[0].lead_intake_id).toBeUndefined();
    expect(db.opportunities[0].stage).toBe('discovery');
  });

  it('is idempotent — calling it twice never creates a second job', async () => {
    const { admin, db } = makeFakeAdmin({ opportunities: [{ ...baseOpp }] });
    const first = await ensureDesignJobForOpportunity(admin, 'o1', 'u1');
    const second = await ensureDesignJobForOpportunity(admin, 'o1', 'u2');
    expect(second.created).toBe(false);
    expect(second.jobId).toBe(first.jobId);
    expect(db.sales_design_jobs).toHaveLength(1);
  });

  it('does not downgrade a stage Sales already moved past (e.g. already in negotiation)', async () => {
    const { admin, db } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'negotiation' }] });
    await ensureDesignJobForOpportunity(admin, 'o1', 'u1');
    expect(db.opportunities[0].stage).toBe('negotiation');
  });
});

describe('syncOpportunityStageFromDesignJob', () => {
  it('advances only from the expected stage', async () => {
    const { admin, db } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'discovery' }] });
    await syncOpportunityStageFromDesignJob(admin, { opportunity_id: 'o1' }, 'discovery', 'sales_design');
    expect(db.opportunities[0].stage).toBe('sales_design');
  });

  it('is a no-op when the Opportunity is not in the expected fromStage', async () => {
    const { admin, db } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'negotiation' }] });
    await syncOpportunityStageFromDesignJob(admin, { opportunity_id: 'o1' }, 'discovery', 'sales_design');
    expect(db.opportunities[0].stage).toBe('negotiation');
  });

  it('is a no-op for a lead-anchored job (no opportunity_id)', async () => {
    const { admin, db } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'discovery' }] });
    await syncOpportunityStageFromDesignJob(admin, { opportunity_id: null }, 'discovery', 'sales_design');
    expect(db.opportunities[0].stage).toBe('discovery');
  });
});
