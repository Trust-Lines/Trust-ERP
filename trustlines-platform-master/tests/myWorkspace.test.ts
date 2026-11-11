import { describe, expect, it } from 'vitest';
import { loadMyTasks } from '@/lib/myWorkspace/tasks';
import { byUrgency, isOverdue, type MyTask } from '@/lib/myWorkspace/taskTypes';
import { DEFAULT_PERMISSIONS, pageAllowed } from '@/lib/permissions/catalog';
import { buildNavSections } from '@/components/platform/shell/Sidebar';
import type { UserRole } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

// In-memory stand-in for the service-role client: eq / neq / in / is / gte filters, the rest
// (or, order, limit) pass through. Enough for the queries the My Tasks loader and the access
// checks it reuses make.
type Row = Record<string, any>;
function fakeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const q: any = {
        select: () => q,
        eq: (c: string, v: unknown) => { rows = rows.filter(r => r[c] === v); return q; },
        neq: (c: string, v: unknown) => { rows = rows.filter(r => r[c] !== v); return q; },
        in: (c: string, vs: unknown[]) => { rows = rows.filter(r => vs.includes(r[c])); return q; },
        is: (c: string, v: unknown) => { rows = rows.filter(r => (r[c] ?? null) === v); return q; },
        gte: (c: string, v: string) => { rows = rows.filter(r => r[c] >= v); return q; },
        or: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (ok: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok),
      };
      return q;
    },
  };
}

const ME = 'me';
const OTHER = 'other';

function world(regions: string[] = []) {
  return fakeAdmin({
    profiles: [{ id: ME, assigned_regions: regions }],
    lead_tasks: [
      { id: 't-ne', opportunity_id: 'opp-ne', title: 'Call NE', status: 'todo', due_date: '2026-11-01', assignee_id: ME },
      { id: 't-se', opportunity_id: 'opp-se', title: 'Call SE', status: 'todo', due_date: null, assignee_id: ME },
      { id: 't-gone', opportunity_id: 'opp-gone', title: 'Deleted deal', status: 'todo', due_date: null, assignee_id: ME },
      { id: 't-other', opportunity_id: 'opp-ne', title: 'Someone else', status: 'todo', due_date: null, assignee_id: OTHER },
      { id: 't-lead', lead_intake_id: 'lead-1', title: 'Old lead', status: 'in_progress', due_date: '2026-12-01', assignee_id: ME },
    ],
    opportunities: [
      { id: 'opp-ne', title: 'NE deal', region: 'TLINES_NE', sales_owner_id: OTHER },
      { id: 'opp-se', title: 'SE deal', region: 'TLINES_SE', sales_owner_id: OTHER },
      { id: 'opp-gone', title: 'Gone', region: 'TLINES_NE', deleted_at: '2026-10-01' },
    ],
    lead_intake: [{ id: 'lead-1', customer_name: 'Acme' }],
    customer_follow_ups: [
      { id: 'fu-1', customer_id: 'c-1', project_id: 'p-1', note: 'Send handover pack', due_date: '2026-10-20', status: 'open', assignee_id: ME },
      { id: 'fu-2', customer_id: 'c-1', project_id: null, note: 'Not mine', due_date: '2026-10-20', status: 'open', assignee_id: OTHER },
    ],
    projects: [{ id: 'p-1', code: 'P-490' }],
    customers: [{ id: 'c-1', name: 'Acme Stores' }],
  });
}

const ids = (tasks: MyTask[]) => tasks.map(t => t.id).sort();

describe('My Tasks — only my rows, with each module’s access rules', () => {
  it('a region-scoped rep sees their own tasks on deals in their region, never another person’s', async () => {
    const tasks = await loadMyTasks(world(['TLINES_NE']), ME, 'sales_rep', DEFAULT_PERMISSIONS.sales_rep ?? {});
    expect(ids(tasks)).toEqual(['fu-1', 't-lead', 't-ne']);
    const ne = tasks.find(t => t.id === 't-ne')!;
    expect(ne.source).toBe('sales');
    expect(ne.record).toEqual({ label: 'NE deal', href: '/leads?open=opp-ne' });
    expect(ne.statusApi).toEqual({ kind: 'lead', url: '/api/marketing/opportunities/opp-ne/tasks/t-ne' });
    const fu = tasks.find(t => t.id === 'fu-1')!;
    expect(fu).toMatchObject({ source: 'customers', status: 'todo', project: { id: 'p-1', code: 'P-490' } });
    expect(fu.statusApi?.url).toBe('/api/customers/c-1/follow-ups/fu-1');
  });

  it('a rep without regions still sees tasks assigned to them (the deal API lets an assignee in)', async () => {
    const tasks = await loadMyTasks(world([]), ME, 'sales_rep', DEFAULT_PERMISSIONS.sales_rep ?? {});
    expect(ids(tasks)).toEqual(['fu-1', 't-lead', 't-ne', 't-se']);
  });

  it('a role outside Sales / Marketing / Customers gets none of those rows', async () => {
    const tasks = await loadMyTasks(world(), ME, 'designer', DEFAULT_PERMISSIONS.designer ?? {});
    expect(tasks).toEqual([]);
  });

  it('Marketing opens a deal in its own Potentials view', async () => {
    const tasks = await loadMyTasks(world(), ME, 'marketing_manager', DEFAULT_PERMISSIONS.marketing_manager ?? {});
    const ne = tasks.find(t => t.id === 't-ne')!;
    expect(ne.source).toBe('marketing');
    expect(ne.record.href).toBe('/marketing/opportunities?open=opp-ne&kind=opportunity');
    expect(tasks.some(t => t.id === 't-lead')).toBe(false); // old lead intake = Sales only
  });

  it('overdue and ordering', () => {
    const t = (id: string, dueDate: string | null, status: MyTask['status'] = 'todo') =>
      ({ id, dueDate, status } as MyTask);
    expect(isOverdue(t('a', '2026-11-10'), '2026-11-11')).toBe(true);
    expect(isOverdue(t('a', '2026-11-11'), '2026-11-11')).toBe(false);
    expect(isOverdue(t('a', '2026-11-01', 'done'), '2026-11-11')).toBe(false);
    const sorted = [t('none', null), t('done', '2026-01-01', 'done'), t('late', '2026-11-01'), t('soon', '2026-11-20')].sort(byUrgency);
    expect(sorted.map(x => x.id)).toEqual(['late', 'soon', 'none', 'done']);
  });
});

describe('My Workspace in the sidebar', () => {
  const links = (role: string) => buildNavSections(role as UserRole, DEFAULT_PERMISSIONS[role] ?? {}).flatMap(s => s.items.map(i => i.href));

  it('is the first group, for every role, before T-Lines PM', () => {
    for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
      const sections = buildNavSections(role as UserRole, DEFAULT_PERMISSIONS[role]);
      expect(sections[0]?.key, role).toBe('my-workspace');
      expect(pageAllowed(role, DEFAULT_PERMISSIONS[role], 'page.my_workspace'), role).toBe(true);
    }
    expect(links('tlines_pm')).toEqual(expect.arrayContaining([
      '/workspace', '/workspace/tasks', '/workspace/approvals', '/workspace/calendar', '/workspace/messages', '/workspace/notifications',
    ]));
  });

  it('the moved personal pages are no longer in their old groups', () => {
    const all = links('ops_manager');
    for (const old of ['/meetings', '/hr/my-work', '/hr/messages', '/my-tasks']) expect(all).not.toContain(old);
    // Department pages stay where they are.
    for (const kept of ['/approvals', '/hr/calendar', '/sales-tasks']) expect(all).toContain(kept);
  });

  it('an admin can switch it off for a role', () => {
    expect(pageAllowed('designer', { 'page.my_workspace': false }, 'page.my_workspace')).toBe(false);
  });
});
