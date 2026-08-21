import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onSiteReady, onPoChainComplete, onContainerArrived, onChangeRequestApproved } from '@/lib/events/handlers';
import { catGroupToType } from '@/lib/production/board';
import { CONTAINER_ARRIVAL_STATUSES } from '@/lib/logistics/containers';
import type { SystemEvent } from '@/lib/events/types';

const audits: { action: string; newValue?: unknown }[] = [];
vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async (p: { action: string; newValue?: unknown }) => { audits.push(p); }),
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn(async () => {}) }));
vi.mock('@/lib/permissions/server', () => ({ userCan: vi.fn(async () => true) }));

function fakeDb(seed: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    projects: [], production_items: [], container_items: [], notifications: [], profiles: [], ...seed,
  };
  const api = {
    tables,
    from(table: string) {
      const eqs: [string, any][] = [];
      let inFilter: [string, any[]] | null = null;
      const q: any = {
        select() { return q; },
        eq(c: string, v: any) { eqs.push([c, v]); return q; },
        is(c: string, v: any) { eqs.push([c, v]); return q; },
        in(c: string, v: any[]) { inFilter = [c, v]; return q; },
        limit() { return q; },
        rows() {
          return (tables[table] ?? []).filter(r =>
            eqs.every(([c, v]) => r[c] === v) &&
            (!inFilter || inFilter[1].includes(r[inFilter[0]])));
        },
        async maybeSingle() { return { data: q.rows()[0] ?? null, error: null }; },
        async single() { return { data: q.rows()[0] ?? null, error: null }; },
        then(res: any) { return Promise.resolve({ data: q.rows(), error: null }).then(res); },
        async insert(payload: any) {
          for (const r of (Array.isArray(payload) ? payload : [payload])) tables[table].push(r);
          return { data: null, error: null };
        },
      };
      return q;
    },
  };
  return api as any;
}

const PROJECT = {
  id: 'p1', code: 'STW 460', name: 'Fifth Avenue Store',
  tlines_pm_id: 'tpm', trustlines_pm_id: 'trpm', customer_id: 'c1',
};
const evt = (over: Partial<SystemEvent> = {}): SystemEvent => ({
  id: 'e1', event_type: 'site.ready', project_id: 'p1', lead_id: null,
  entity_table: 'site_readiness', entity_id: 's1', actor_id: 'actor',
  payload: {}, dedupe_key: 'k', created_at: '2026-07-14T00:00:00Z', processed_at: null,
  ...over,
});
const users = (rows: { id: string; role: string }[]) =>
  rows.map(r => ({ ...r, is_active: true, full_name: r.id, email: `${r.id}@x.com` }));

beforeEach(() => { audits.length = 0; });

describe('A3 — site ready', () => {
  it('tells the PMs and logistics that the build can be scheduled', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: users([{ id: 'log1', role: 'logistics' }, { id: 'log2', role: 'logistics' }, { id: 'x', role: 'accounting' }]),
    });
    await onSiteReady(db, evt());

    expect(db.tables.notifications.map((n: any) => n.user_id).sort()).toEqual(['log1', 'log2', 'tpm', 'trpm']);
    expect(db.tables.notifications[0].title).toBe('Site ready: STW 460');
    expect(db.tables.notifications[0].link).toBe('/projects/p1/delivery');
    expect(audits.map(a => a.action)).toContain('automation.a3_site_ready');
  });
});

describe('A4 — PO chain complete', () => {
  const poEvent = (typeName: string | null) => evt({
    event_type: 'po.chain_complete', entity_table: 'documents', entity_id: 'd1',
    payload: typeName ? { typeName } : {},
  });

  it('asks the production manager to assign a vendor when the signed type has none', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: users([{ id: 'pmgr', role: 'production_manager' }]),
      production_items: [
        { id: 'i1', project_id: 'p1', source: 'project', deleted_at: null, type: 'Millwork', vendor_id: null },
        { id: 'i2', project_id: 'p1', source: 'project', deleted_at: null, type: 'Ceiling', vendor_id: 'v9' },
      ],
    });
    await onPoChainComplete(db, poEvent('Millwork'));

    const n = db.tables.notifications;
    expect(n.map((x: any) => x.user_id).sort()).toEqual(['pmgr', 'trpm']);
    expect(n[0].type).toBe('po.vendor_needed');
    expect(n[0].body).toContain('Millwork');
    expect(audits[0].newValue).toMatchObject({ typeName: 'Millwork', awaitingVendor: 1 });
  });

  it('sends an informational notice when the type already has a vendor', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: users([{ id: 'pmgr', role: 'production_manager' }]),
      production_items: [{ id: 'i2', project_id: 'p1', source: 'project', deleted_at: null, type: 'Ceiling', vendor_id: 'v9' }],
    });
    await onPoChainComplete(db, poEvent('Ceiling'));

    expect(db.tables.notifications.map((n: any) => n.type)).toEqual(['po.chain_complete']);
    expect(db.tables.notifications.map((n: any) => n.user_id)).toEqual(['trpm']);
    expect(audits[0].newValue).toMatchObject({ awaitingVendor: 0 });
  });

  it('never puts the vendor itself in the notification — only that one is missing', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: users([{ id: 'pmgr', role: 'production_manager' }]),
      production_items: [{ id: 'i1', project_id: 'p1', source: 'project', deleted_at: null, type: 'Millwork', vendor_id: null }],
    });
    await onPoChainComplete(db, poEvent('Millwork'));
    const seen = JSON.stringify(db.tables.notifications).toLowerCase();
    for (const forbidden of ['vendor_id', 'v9', 'price', 'cost', 'margin', 'pf_usd']) {
      expect(seen).not.toContain(forbidden);
    }
  });

  it('falls back to every project type when the PO carries no category', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: users([{ id: 'pmgr', role: 'production_manager' }]),
      production_items: [
        { id: 'i1', project_id: 'p1', source: 'project', deleted_at: null, type: 'Millwork', vendor_id: null },
        { id: 'i2', project_id: 'p1', source: 'project', deleted_at: null, type: 'Ceiling', vendor_id: null },
      ],
    });
    await onPoChainComplete(db, poEvent(null));
    expect(audits[0].newValue).toMatchObject({ awaitingVendor: 2 });
  });
});

describe('catGroupToType', () => {
  it('maps a document category to its board type', () => {
    expect(catGroupToType('millwork')).toBe('Millwork');
    expect(catGroupToType('CEILING')).toBe('Ceiling');
    expect(catGroupToType('image')).toBe('Image');
  });
  it('returns null for a project-wide document with no category', () => {
    expect(catGroupToType(null)).toBeNull();
    expect(catGroupToType('')).toBeNull();
    expect(catGroupToType('nonsense')).toBeNull();
  });
});

describe('A6 — container arrived', () => {
  const arrival = (status: string) => evt({
    event_type: 'container.arrived', entity_table: 'containers', entity_id: 'ct1',
    project_id: null, payload: { status, containerNo: 'MSKU-1' },
  });

  it('fans out to EVERY project whose goods are on the container', async () => {
    const db = fakeDb({
      projects: [PROJECT, { id: 'p2', code: 'STW 461', name: 'Second Store', tlines_pm_id: 'tpm2', trustlines_pm_id: null, customer_id: null }],
      container_items: [{ container_id: 'ct1', production_item_id: 'i1' }, { container_id: 'ct1', production_item_id: 'i2' }],
      production_items: [{ id: 'i1', project_id: 'p1' }, { id: 'i2', project_id: 'p2' }],
    });
    await onContainerArrived(db, arrival('WAREHOUSE'));

    const byProject = db.tables.notifications.map((n: any) => n.project_id).sort();
    expect(byProject).toEqual(['p1', 'p1', 'p2']);
    expect(db.tables.notifications[0].title).toContain('Container MSKU-1 reached the warehouse');
    expect(audits[0].newValue).toMatchObject({ projects: 2, status: 'WAREHOUSE' });
  });

  it('words the port arrival differently from the warehouse arrival', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      container_items: [{ container_id: 'ct1', production_item_id: 'i1' }],
      production_items: [{ id: 'i1', project_id: 'p1' }],
    });
    await onContainerArrived(db, arrival('ARRIVED_PORT'));
    expect(db.tables.notifications[0].title).toContain('arrived at port');
  });

  it('does nothing for an empty container', async () => {
    const db = fakeDb({ projects: [PROJECT], container_items: [], production_items: [] });
    await onContainerArrived(db, arrival('WAREHOUSE'));
    expect(db.tables.notifications).toHaveLength(0);
  });

  it('both arrival milestones are announced, not just one', () => {
    expect([...CONTAINER_ARRIVAL_STATUSES].sort()).toEqual(['ARRIVED_PORT', 'WAREHOUSE']);
  });
});

describe('A7 — change request approved', () => {
  const crEvent = evt({
    event_type: 'change_request.approved', entity_table: 'change_requests', entity_id: 'cr1',
    payload: { title: 'Extra shelving on wall B' },
  });

  it('tells the Trust PM and Supply that the scope changed', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: users([{ id: 'pmgr', role: 'production_manager' }, { id: 'pmw', role: 'pm_millwork' }]),
    });
    await onChangeRequestApproved(db, crEvent);

    expect(db.tables.notifications.map((n: any) => n.user_id).sort()).toEqual(['pmgr', 'pmw', 'trpm']);
    expect(db.tables.notifications[0].body).toContain('Extra shelving on wall B');
    expect(audits.map(a => a.action)).toContain('automation.a7_change_request_approved');
  });

  it('carries NO budget figure — the delta stays on the Finance page, not in a notification', async () => {
    const db = fakeDb({ projects: [PROJECT], profiles: users([{ id: 'pmgr', role: 'production_manager' }]) });
    await onChangeRequestApproved(db, evt({
      event_type: 'change_request.approved', entity_table: 'change_requests', entity_id: 'cr1',
      payload: { title: 'Extra shelving', budget_impact: 25000 },
    }));
    const seen = JSON.stringify(db.tables.notifications);
    expect(seen).not.toContain('25000');
    expect(seen.toLowerCase()).not.toContain('budget');
  });
});
