import { describe, it, expect, vi } from 'vitest';
import {
  initiateHandoff, acceptOpportunity, returnOpportunity, closeWon, closeLost,
  ensureProjectForOpportunity, HandoffError,
} from '@/lib/marketing/salesHandoff';

vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('@/lib/dropbox/upload', () => ({
  createProjectFolders: vi.fn(async () => ({ rootPath: '/fake', subFolders: [], alreadyExists: false })),
}));

function makeFakeAdmin(seed: {
  opportunities?: any[]; prospects?: any[]; customers?: any[]; projects?: any[];
  prospect_needs?: any[]; prospect_locations?: any[];
  onReserveNumber?: (db: Record<string, any[]>) => void;
} = {}) {
  const db: Record<string, any[]> = {
    opportunities: seed.opportunities ?? [], prospects: seed.prospects ?? [],
    customers: seed.customers ?? [], projects: seed.projects ?? [],
    prospect_needs: seed.prospect_needs ?? [], prospect_locations: seed.prospect_locations ?? [],
  };
  let idCounter = 1;
  let rpcCallCount = 0;

  function from(table: string) {
    const rows = db[table];
    let filtered = rows;
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;

    const builder: any = {
      select: () => builder,
      eq: (f: string, v: unknown) => { filtered = filtered.filter(r => r[f] === v); return builder; },
      is: (f: string, v: unknown) => { filtered = filtered.filter(r => (v === null ? r[f] == null : r[f] === v)); return builder; },
      ilike: (f: string, v: string) => { filtered = filtered.filter(r => String(r[f] ?? '').toLowerCase() === String(v).toLowerCase()); return builder; },
      limit: () => builder,
      insert: (row: Record<string, unknown>) => {
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

  return {
    admin: {
      from,
      rpc: async (name: string) => {
        if (name === 'reserve_global_number') {
          rpcCallCount++;
          seed.onReserveNumber?.(db);
          return { data: 100 + rpcCallCount, error: null };
        }
        return { data: null, error: null };
      },
    } as any,
    db,
    get rpcCallCount() { return rpcCallCount; },
  };
}

const baseOpp = {
  id: 'o1', prospect_id: 'p1', need_id: 'n1', title: 'ZZTEST Opp', project_id: null,
  stage: 'new', scope_types: ['millwork'], sales_owner_id: null, sales_handoff_at: null,
  sales_accepted_at: null, closed_at: null, closed_reason: null, return_reason: null, customer_id: null,
};
const acceptInput = { region: 'TLINES_NE', serviceLine: 'store_maker', city: 'New York', state: 'NY', customerName: 'ZZTEST Customer' };

describe('initiateHandoff', () => {
  it('moves a qualifying Opportunity from new/marketing_qualification to sales_handoff', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ ...baseOpp }] });
    const result = await initiateHandoff(admin, 'o1', 'u1', null);
    expect(result.stage).toBe('sales_handoff');
    expect(result.sales_handoff_at).toBeTruthy();
  });

  it('rejects handing off an Opportunity that is not new/marketing_qualification', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'sales_accepted' }] });
    await expect(initiateHandoff(admin, 'o1', 'u1', null)).rejects.toThrow(HandoffError);
  });
});

describe('acceptOpportunity — idempotent, creates exactly one Project', () => {
  it('creates a Project, reserves a number once, and moves the Opportunity to sales_accepted', async () => {
    const fake = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'sales_handoff' }] });
    const result = await acceptOpportunity(fake.admin, 'o1', 'u1', acceptInput);
    expect(result.alreadyAccepted).toBe(false);
    expect(result.opportunity.stage).toBe('sales_accepted');
    expect(result.opportunity.project_id).toBe(result.project.id);
    expect(fake.db.projects).toHaveLength(1);
    expect(fake.rpcCallCount).toBe(1);
  });

  it('calling accept twice never reserves a second number or creates a second Project', async () => {
    const { admin, db } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'sales_handoff' }] });
    const first = await acceptOpportunity(admin, 'o1', 'u1', acceptInput);
    const second = await acceptOpportunity(admin, 'o1', 'u2', acceptInput);
    expect(second.alreadyAccepted).toBe(true);
    expect(second.project.id).toBe(first.project.id);
    expect(db.projects).toHaveLength(1);
  });

  it('rejects accepting an Opportunity that was never handed off', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'new' }] });
    await expect(acceptOpportunity(admin, 'o1', 'u1', acceptInput)).rejects.toThrow(HandoffError);
  });

  it('rejects an invalid region or service line', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'sales_handoff' }] });
    await expect(acceptOpportunity(admin, 'o1', 'u1', { ...acceptInput, region: 'NOT_A_REGION' })).rejects.toThrow(HandoffError);
  });
});

describe('returnOpportunity', () => {
  it('sends a sales_handoff Opportunity back to marketing_qualification with a reason, clearing the owner', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'sales_handoff', sales_owner_id: 'u1' }] });
    const result = await returnOpportunity(admin, 'o1', 'u1', 'Budget unclear');
    expect(result.stage).toBe('marketing_qualification');
    expect(result.return_reason).toBe('Budget unclear');
    expect(result.sales_owner_id).toBeNull();
  });

  it('requires a reason', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'sales_handoff' }] });
    await expect(returnOpportunity(admin, 'o1', 'u1', '')).rejects.toThrow(HandoffError);
  });

  it('cannot return an already-accepted Opportunity (a Project already exists)', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'sales_accepted', project_id: 'proj-1' }] });
    await expect(returnOpportunity(admin, 'o1', 'u1', 'too late')).rejects.toThrow(HandoffError);
  });
});

describe('closeWon', () => {
  it('requires the Opportunity to already have an accepted Project', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ ...baseOpp, stage: 'sales_accepted', project_id: null }] });
    await expect(closeWon(admin, 'o1', 'u1')).rejects.toThrow(HandoffError);
  });

  it('creates a Customer from the Prospect and links it to the Opportunity + Project', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ ...baseOpp, stage: 'sales_accepted', project_id: 'proj-1' }],
      prospects: [{ id: 'p1', customer_id: null, display_name: 'ZZTEST Acme', main_email: 'a@x.com', main_phone: '555' }],
      projects: [{ id: 'proj-1', customer_id: null }],
    });
    const result = await closeWon(admin, 'o1', 'u1');
    expect(result.stage).toBe('closed_won');
    expect(result.customer_id).toBeTruthy();
    expect(db.customers).toHaveLength(1);
    expect(db.prospects[0].customer_id).toBe(result.customer_id);
    expect(db.projects[0].customer_id).toBe(result.customer_id);
  });

  it('is idempotent — closing an already-closed_won Opportunity is a no-op, no second Customer created', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ ...baseOpp, stage: 'closed_won', project_id: 'proj-1', customer_id: 'cust-1' }],
      prospects: [{ id: 'p1', customer_id: 'cust-1', display_name: 'ZZTEST Acme' }],
    });
    const result = await closeWon(admin, 'o1', 'u1');
    expect(result.stage).toBe('closed_won');
    expect(db.customers).toHaveLength(0);
  });
});

describe('closeLost', () => {
  it('requires a reason and preserves the Opportunity/Project (never deletes)', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ ...baseOpp, stage: 'sales_accepted', project_id: 'proj-1' }],
      projects: [{ id: 'proj-1' }],
    });
    await expect(closeLost(admin, 'o1', 'u1', '')).rejects.toThrow(HandoffError);
    const result = await closeLost(admin, 'o1', 'u1', 'Went with a competitor');
    expect(result.stage).toBe('closed_lost');
    expect(result.closed_reason).toBe('Went with a competitor');
    expect(db.projects).toHaveLength(1);
  });
});

describe('ensureProjectForOpportunity', () => {
  const wotOpp = { ...baseOpp, stage: 'working_on_it_trust', region: 'TLINES_NE' };
  const fullNeed = { id: 'n1', region: 'TLINES_NE', service_line: 'store_maker', state: 'NY', location_id: 'loc1' };
  const fullLocation = { id: 'loc1', city: 'New York' };
  const fullProspect = { id: 'p1', customer_id: null, display_name: 'ZZTEST Acme', main_email: 'a@x.com', main_phone: '555' };

  it('creates a Project (with Customer linked) and reserves exactly one number', async () => {
    const fake = makeFakeAdmin({
      opportunities: [{ ...wotOpp }], prospects: [{ ...fullProspect }],
      prospect_needs: [{ ...fullNeed }], prospect_locations: [{ ...fullLocation }],
    });
    const result = await ensureProjectForOpportunity(fake.admin, 'o1', 'u1');
    expect(result.alreadyExisted).toBe(false);
    expect(fake.db.projects).toHaveLength(1);
    expect(fake.rpcCallCount).toBe(1);
    expect(fake.db.opportunities[0].project_id).toBe(result.project.id);
    expect(fake.db.customers).toHaveLength(1);
    expect(result.project.customer_id).toBe(fake.db.customers[0].id);
    expect(fake.db.opportunities[0].customer_id).toBe(fake.db.customers[0].id);
  });

  it('is idempotent — already has a Project, never reserves a second number', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ ...wotOpp, project_id: 'proj-1' }],
      projects: [{ id: 'proj-1', code: 'STNE100' }],
    });
    const result = await ensureProjectForOpportunity(admin, 'o1', 'u1');
    expect(result.alreadyExisted).toBe(true);
    expect(result.project.id).toBe('proj-1');
    expect(db.projects).toHaveLength(1);
  });

  it('rejects when region/service_line/state/city cannot be resolved from the Need/Location', async () => {
    const { admin } = makeFakeAdmin({
      opportunities: [{ ...wotOpp }], prospects: [{ ...fullProspect }],
      prospect_needs: [{ id: 'n1', region: 'TLINES_NE', service_line: null, state: 'NY', location_id: null }],
    });
    await expect(ensureProjectForOpportunity(admin, 'o1', 'u1')).rejects.toThrow(HandoffError);
    await expect(ensureProjectForOpportunity(admin, 'o1', 'u1')).rejects.toThrow(/service line/);
  });

  it('never opens a second Project when a concurrent call wins the race first', async () => {
    const fake = makeFakeAdmin({
      opportunities: [{ ...wotOpp }], prospects: [{ ...fullProspect }],
      prospect_needs: [{ ...fullNeed }], prospect_locations: [{ ...fullLocation }],
      projects: [{ id: 'race-winner', code: 'STNE999' }],
      onReserveNumber: db => { db.opportunities[0].project_id = 'race-winner'; },
    });
    const result = await ensureProjectForOpportunity(fake.admin, 'o1', 'u1');
    expect(result.alreadyExisted).toBe(true);
    expect(result.project.id).toBe('race-winner');
    expect(fake.db.projects).toHaveLength(2);
    expect(fake.db.opportunities[0].project_id).toBe('race-winner');
  });
});
