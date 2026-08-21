import { describe, it, expect } from 'vitest';
import { canAccessOpportunity } from '@/lib/marketing/opportunityAccess';
import { logLeadActivity } from '@/lib/sales/activity';
import { notifyUser, notifyLeadWatchers } from '@/lib/sales/notify';

function makeFakeAdmin(seed: {
  opportunities?: any[]; lead_tasks?: any[]; lead_activity?: any[]; lead_watchers?: any[]; lead_intake?: any[];
} = {}) {
  const db: Record<string, any[]> = {
    opportunities: seed.opportunities ?? [], lead_tasks: seed.lead_tasks ?? [],
    lead_activity: seed.lead_activity ?? [], lead_watchers: seed.lead_watchers ?? [], lead_intake: seed.lead_intake ?? [],
  };
  let idCounter = 1;

  function from(table: string) {
    const rows = db[table] ?? (db[table] = []);
    let filtered = rows;
    let limited: any[] | null = null;
    let pendingInsert: Record<string, unknown>[] | null = null;

    const builder: any = {
      select: () => builder,
      eq: (f: string, v: unknown) => { filtered = (limited ?? filtered).filter(r => r[f] === v); limited = null; return builder; },
      limit: (n: number) => { limited = filtered.slice(0, n); return builder; },
      insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
        pendingInsert = (Array.isArray(row) ? row : [row]).map(r => ({ id: `${table}-${idCounter++}`, ...r }));
        return builder;
      },
      maybeSingle: async () => {
        if (pendingInsert) { rows.push(...pendingInsert); return { data: pendingInsert[0], error: null }; }
        return { data: (limited ?? filtered)[0] ?? null, error: null };
      },
      single: async () => builder.maybeSingle(),
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        if (pendingInsert) { rows.push(...pendingInsert); resolve({ data: pendingInsert, error: null }); return; }
        resolve({ data: limited ?? filtered, error: null });
      },
    };
    return builder;
  }

  return { admin: { from } as any, db };
}

describe('canAccessOpportunity', () => {
  it('grants full-access roles regardless of ownership', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ id: 'o1', sales_owner_id: null, marketing_owner_id: null }] });
    expect(await canAccessOpportunity(admin, 'o1', 'anyone', 'general_manager')).toBe(true);
  });

  it('grants the sales_owner or marketing_owner', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ id: 'o1', sales_owner_id: 'u1', marketing_owner_id: null }] });
    expect(await canAccessOpportunity(admin, 'o1', 'u1', 'marketing_pr')).toBe(true);
    expect(await canAccessOpportunity(admin, 'o1', 'someone-else', 'marketing_pr')).toBe(false);
  });

  it('grants a user with a task assigned to them on the opportunity (subtask tolerance)', async () => {
    const { admin } = makeFakeAdmin({
      opportunities: [{ id: 'o1', sales_owner_id: null, marketing_owner_id: null }],
      lead_tasks: [{ id: 't1', opportunity_id: 'o1', assignee_id: 'u2' }],
    });
    expect(await canAccessOpportunity(admin, 'o1', 'u2', 'marketing_pr')).toBe(true);
  });

  it('denies an unrelated user with a non-privileged role', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ id: 'o1', sales_owner_id: 'u1', marketing_owner_id: null }] });
    expect(await canAccessOpportunity(admin, 'o1', 'u2', 'marketing_pr')).toBe(false);
  });

  it('returns false for a nonexistent opportunity', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [] });
    expect(await canAccessOpportunity(admin, 'missing', 'u1', 'marketing_pr')).toBe(false);
  });
});

describe('canAccessOpportunity — region-based visibility (CRM Faz 4)', () => {
  it('lets a region-scoped user reach an opportunity in their region they neither own nor have a task on', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ id: 'o1', sales_owner_id: null, marketing_owner_id: null, region: 'TLINES_NE' }],
    });
    db.profiles = [{ id: 'u2', assigned_regions: ['TLINES_NE'] }];
    expect(await canAccessOpportunity(admin, 'o1', 'u2', 'marketing_pr')).toBe(true);
  });

  it('blocks a region-scoped user from an opportunity in a DIFFERENT region, even one they own', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ id: 'o1', sales_owner_id: null, marketing_owner_id: 'u2', region: 'TLINES_SE' }],
    });
    db.profiles = [{ id: 'u2', assigned_regions: ['TLINES_NE'] }];
    expect(await canAccessOpportunity(admin, 'o1', 'u2', 'marketing_pr')).toBe(false);
  });

  it('blocks a region-scoped user from an opportunity with no region set yet', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ id: 'o1', sales_owner_id: null, marketing_owner_id: null, region: null }],
    });
    db.profiles = [{ id: 'u2', assigned_regions: ['TLINES_NE'] }];
    expect(await canAccessOpportunity(admin, 'o1', 'u2', 'marketing_pr')).toBe(false);
  });

  it('falls back to ownership when the user has no assigned region yet', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ id: 'o1', sales_owner_id: null, marketing_owner_id: 'u2', region: 'TLINES_SE' }],
    });
    db.profiles = [{ id: 'u2', assigned_regions: [] }];
    expect(await canAccessOpportunity(admin, 'o1', 'u2', 'marketing_pr')).toBe(true);
  });

  it('no longer treats a plain sales_rep as automatically full-access once they have a region', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ id: 'o1', sales_owner_id: null, marketing_owner_id: null, region: 'TLINES_SE' }],
    });
    db.profiles = [{ id: 'u3', assigned_regions: ['TLINES_NE'] }];
    expect(await canAccessOpportunity(admin, 'o1', 'u3', 'sales_rep')).toBe(false);
  });

  it('still grants sales_marketing_manager unconditionally (region-exempt manager role)', async () => {
    const { admin } = makeFakeAdmin({ opportunities: [{ id: 'o1', sales_owner_id: null, marketing_owner_id: null, region: 'TLINES_SE' }] });
    expect(await canAccessOpportunity(admin, 'o1', 'anyone', 'sales_marketing_manager')).toBe(true);
  });
});

describe('logLeadActivity (dual anchor)', () => {
  it('writes lead_intake_id when given a lead anchor', async () => {
    const { admin, db } = makeFakeAdmin();
    await logLeadActivity(admin, { leadIntakeId: 'l1', actorId: 'u1', kind: 'comment', body: 'hi' });
    expect(db.lead_activity).toHaveLength(1);
    expect(db.lead_activity[0].lead_intake_id).toBe('l1');
    expect(db.lead_activity[0].opportunity_id).toBeNull();
  });

  it('writes opportunity_id when given an opportunity anchor', async () => {
    const { admin, db } = makeFakeAdmin();
    await logLeadActivity(admin, { opportunityId: 'o1', actorId: 'u1', kind: 'comment', body: 'hi' });
    expect(db.lead_activity).toHaveLength(1);
    expect(db.lead_activity[0].opportunity_id).toBe('o1');
    expect(db.lead_activity[0].lead_intake_id).toBeNull();
  });
});

describe('notifyUser / notifyLeadWatchers link building', () => {
  it('notifyUser links to /leads/[id] for a lead anchor', async () => {
    const { admin, db } = makeFakeAdmin();
    await notifyUser(admin, { userId: 'u1', title: 't', body: 'b', leadId: 'l1' });
    expect(db.notifications[0].link).toBe('/leads/l1');
    expect(db.notifications[0].type).toBe('lead');
  });

  it('notifyUser links to the parent Prospect 360 Opportunities tab for an opportunity anchor', async () => {
    const { admin, db } = makeFakeAdmin({ opportunities: [{ id: 'o1', prospect_id: 'p1' }] });
    await notifyUser(admin, { userId: 'u1', title: 't', body: 'b', opportunityId: 'o1' });
    expect(db.notifications[0].link).toBe('/marketing/prospects/p1?tab=opportunities');
    expect(db.notifications[0].type).toBe('opportunity');
  });

  it('notifyLeadWatchers excludes the actor and notifies owners for an opportunity', async () => {
    const { admin, db } = makeFakeAdmin({
      opportunities: [{ id: 'o1', prospect_id: 'p1', sales_owner_id: 'u2', marketing_owner_id: 'u3' }],
      lead_watchers: [{ opportunity_id: 'o1', user_id: 'u4' }],
    });
    await notifyLeadWatchers(admin, { opportunityId: 'o1', actorId: 'u3', title: 't', body: 'b' });
    const recipients = db.notifications.map((n: any) => n.user_id).sort();
    expect(recipients).toEqual(['u2', 'u4']);
  });
});
