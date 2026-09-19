import { describe, it, expect } from 'vitest';
import { tasksForOpportunity, STAGE_TASK_RULES, OPEN_TASK_STAGES } from '@/lib/sales/taskRules';
import { syncSalesTasks } from '@/lib/sales/syncTasks';

const TODAY = '2026-09-19';
const opp = (o: Partial<Parameters<typeof tasksForOpportunity>[0]> = {}) => ({
  id: 'o1', stage: 'proposal' as const, sales_owner_id: null, estimated_value: 5000, next_action_date: null, ...o,
});

describe('tasksForOpportunity', () => {
  it('proposal sent: asks for the client\'s answer, due today', () => {
    const t = tasksForOpportunity(opp(), TODAY);
    expect(t).toHaveLength(1);
    expect(t[0].title).toMatch(/what was the client.s answer/);
    expect(t[0].due_date).toBe(TODAY);
  });

  it('adds a "deal size" task only while the deal size is missing', () => {
    expect(tasksForOpportunity(opp({ estimated_value: null }), TODAY).map(t => t.title)).toContain('Add the deal size to this opportunity');
    expect(tasksForOpportunity(opp({ estimated_value: 100 }), TODAY).map(t => t.title)).not.toContain('Add the deal size to this opportunity');
  });

  it('every open stage has a task; closed / potential stages have none', () => {
    for (const stage of OPEN_TASK_STAGES) expect(tasksForOpportunity(opp({ stage }), TODAY).length).toBeGreaterThan(0);
    for (const stage of ['closed_won', 'closed_lost', 'new'] as const) expect(tasksForOpportunity(opp({ stage }), TODAY)).toEqual([]);
    expect(Object.keys(STAGE_TASK_RULES).sort()).toEqual(['negotiation', 'on_hold', 'proposal', 'sales_accepted', 'working_on_it_trust']);
  });

  it('waiting deals are due a week out; a date already set on the deal wins; owner is kept', () => {
    expect(tasksForOpportunity(opp({ stage: 'on_hold' }), TODAY)[0].due_date).toBe('2026-09-26');
    expect(tasksForOpportunity(opp({ next_action_date: '2026-10-03T00:00:00Z' }), TODAY)[0].due_date).toBe('2026-10-03');
    expect(tasksForOpportunity(opp({ sales_owner_id: 'rep1' }), TODAY)[0].assignee_id).toBe('rep1');
    expect(tasksForOpportunity(opp(), TODAY)[0].assignee_id).toBeNull();
  });
});

// ── tiny in-memory stand-in for the Supabase client: just what syncSalesTasks calls ──
function fakeAdmin(seed: { opportunities: any[]; lead_tasks?: any[] }) {
  const db: Record<string, any[]> = { opportunities: seed.opportunities, lead_tasks: seed.lead_tasks ?? [] };
  let nextId = 1;
  const from = (table: string) => {
    let rows = db[table];
    let op: 'select' | 'insert' | 'delete' = 'select';
    let payload: any[] = [];
    const filters: ((r: any) => boolean)[] = [];
    let range: [number, number] | null = null;
    const b: any = {
      select() { return b; },
      insert(v: any) { op = 'insert'; payload = Array.isArray(v) ? v : [v]; return b; },
      delete() { op = 'delete'; return b; },
      eq(c: string, v: any) { filters.push(r => r[c] === v); return b; },
      in(c: string, vs: any[]) { filters.push(r => vs.includes(r[c])); return b; },
      is(c: string, v: any) { filters.push(r => (r[c] ?? null) === v); return b; },
      not(c: string, _o: string, v: any) { filters.push(r => (r[c] ?? null) !== v); return b; },
      range(a: number, z: number) { range = [a, z]; return b; },
      then(res: any, rej: any) {
        try {
          if (op === 'insert') { payload.forEach(p => db[table].push({ id: `t${nextId++}`, ...p })); return Promise.resolve({ data: null, error: null }).then(res, rej); }
          if (op === 'delete') { db[table] = rows = db[table].filter(r => !filters.every(f => f(r))); return Promise.resolve({ data: null, error: null }).then(res, rej); }
          let out = db[table].filter(r => filters.every(f => f(r)));
          if (range) out = out.slice(range[0], range[1] + 1);
          return Promise.resolve({ data: out, error: null }).then(res, rej);
        } catch (e) { return Promise.reject(e).then(res, rej); }
      },
    };
    return b;
  };
  return { from, db };
}

const O = (id: string, stage: string, extra: Record<string, unknown> = {}) =>
  ({ id, stage, sales_owner_id: null, estimated_value: 1000, next_action_date: null, deleted_at: null, ...extra });

describe('syncSalesTasks', () => {
  it('creates each open deal\'s tasks once, and is idempotent', async () => {
    const a = fakeAdmin({ opportunities: [O('p1', 'proposal'), O('w1', 'on_hold'), O('c1', 'closed_lost')] });
    const first = await syncSalesTasks(a, { today: TODAY });
    expect(first).toMatchObject({ considered: 2, created: 2, retired: 0 });
    expect(a.db.lead_tasks.map(t => t.opportunity_id).sort()).toEqual(['p1', 'w1']);
    expect(a.db.lead_tasks.every(t => t.status === 'todo' && t.assignee_id === null)).toBe(true);
    const second = await syncSalesTasks(a, { today: TODAY });
    expect(second).toMatchObject({ created: 0, retired: 0 });
    expect(a.db.lead_tasks).toHaveLength(2);
  });

  it('a completed task is not recreated', async () => {
    const a = fakeAdmin({ opportunities: [O('p1', 'proposal')] });
    await syncSalesTasks(a, { today: TODAY });
    a.db.lead_tasks[0].status = 'done';
    const again = await syncSalesTasks(a, { today: TODAY });
    expect(again.created).toBe(0);
    expect(a.db.lead_tasks).toHaveLength(1);
  });

  it('when a deal moves on: new stage gets its task, the old untouched task is retired, started/done ones stay', async () => {
    const a = fakeAdmin({ opportunities: [O('d1', 'proposal'), O('d2', 'proposal')] });
    await syncSalesTasks(a, { today: TODAY });
    const d2task = a.db.lead_tasks.find(t => t.opportunity_id === 'd2')!;
    d2task.status = 'in_progress';
    a.db.opportunities.find(o => o.id === 'd1')!.stage = 'negotiation';
    a.db.opportunities.find(o => o.id === 'd2')!.stage = 'closed_lost';
    const r = await syncSalesTasks(a, { today: TODAY });
    expect(r).toMatchObject({ created: 1, retired: 1 });
    const d1 = a.db.lead_tasks.filter(t => t.opportunity_id === 'd1');
    expect(d1).toHaveLength(1);
    expect(d1[0].title).toMatch(/asked for changes/);
    expect(a.db.lead_tasks.filter(t => t.opportunity_id === 'd2')).toHaveLength(1); // in progress: kept as history
  });

  it('scoped to one opportunity leaves the others alone', async () => {
    const a = fakeAdmin({ opportunities: [O('a', 'proposal'), O('b', 'proposal')] });
    const r = await syncSalesTasks(a, { opportunityId: 'a', today: TODAY });
    expect(r.created).toBe(1);
    expect(a.db.lead_tasks.map(t => t.opportunity_id)).toEqual(['a']);
  });

  it('gives tasks to the deal\'s Sales owner when it has one', async () => {
    const a = fakeAdmin({ opportunities: [O('a', 'proposal', { sales_owner_id: 'rep1' })] });
    await syncSalesTasks(a, { today: TODAY });
    expect(a.db.lead_tasks[0].assignee_id).toBe('rep1');
  });
});
