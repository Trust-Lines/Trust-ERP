import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onLeadClosedWon, onHandoverReady, onProjectItemsReady } from '@/lib/events/handlers';
import { recipientsOf } from '@/lib/events/notify';
import { allItemsSent } from '@/lib/production/board';
import type { SystemEvent } from '@/lib/events/types';

const audits: { action: string; newValue?: unknown }[] = [];
vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async (p: { action: string; newValue?: unknown }) => { audits.push(p); }),
}));

const emails: { to: string; subject: string; html: string }[] = [];
vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn(async (to: string, subject: string, html: string) => { emails.push({ to, subject, html }); }),
}));

let permitted = true;
vi.mock('@/lib/permissions/server', () => ({
  userCan: vi.fn(async () => permitted),
}));

function fakeDb(seed: Record<string, any[]> = {}, opts: { missingTables?: string[] } = {}) {
  const tables: Record<string, any[]> = {
    projects: [], project_handovers: [], customer_follow_ups: [],
    notifications: [], delivery_plans: [], profiles: [], documents: [], customer_meetings: [],
    ...seed,
  };
  const missing = new Set(opts.missingTables ?? []);

  const api = {
    tables,
    from(table: string) {
      const filters: [string, any][] = [];
      const q: any = {
        _table: table,
        select() { return q; },
        eq(col: string, val: any) { filters.push([col, val]); return q; },
        is(col: string, val: any) { filters.push([col, val]); return q; },
        order() { return q; },
        limit() { return q; },
        rows() {
          return (tables[table] ?? []).filter(r => filters.every(([c, v]) => r[c] === v));
        },
        async maybeSingle() {
          if (missing.has(table)) return { data: null, error: { message: `relation "${table}" does not exist`, code: '42P01' } };
          return { data: q.rows()[0] ?? null, error: null };
        },
        async single() {
          if (missing.has(table)) return { data: null, error: { message: 'missing', code: '42P01' } };
          return { data: q.rows()[0] ?? null, error: null };
        },
        async insert(payload: any) {
          if (missing.has(table)) return { data: null, error: { message: 'missing', code: '42P01' } };
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const r of rows) tables[table].push({ id: `${table}-${tables[table].length + 1}`, ...r });
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
  pm_supervisor_id: 'sup', dropbox_root_path: '/x', closed_deal_date: '2026-01-01',
};

const evt = (over: Partial<SystemEvent> = {}): SystemEvent => ({
  id: 'e1', event_type: 'lead.closed_won', project_id: 'p1', lead_id: 'l1',
  entity_table: 'lead_intake', entity_id: 'l1', actor_id: 'actor',
  payload: {}, dedupe_key: 'k', created_at: '2026-07-14T00:00:00Z', processed_at: null,
  ...over,
});

beforeEach(() => { audits.length = 0; emails.length = 0; permitted = true; });

describe('A1 — lead closed won', () => {
  it('opens the handover, notifies both PMs, and schedules the first finalization meeting', async () => {
    const db = fakeDb({ projects: [PROJECT] });
    await onLeadClosedWon(db, evt());

    expect(db.tables.project_handovers).toHaveLength(1);
    expect(db.tables.project_handovers[0].project_id).toBe('p1');
    expect(db.tables.project_handovers[0].checklist.length).toBeGreaterThan(0);

    expect(db.tables.notifications.map((n: any) => n.user_id).sort()).toEqual(['tpm', 'trpm']);
    expect(db.tables.notifications[0].title).toContain('STW 460');

    expect(db.tables.customer_follow_ups).toHaveLength(1);
    const fu = db.tables.customer_follow_ups[0];
    expect(fu.note).toBe('First finalization meeting — STW 460');
    expect(fu.assignee_id).toBe('tpm');
    expect(fu.status).toBe('open');
    expect(fu.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(audits.map(a => a.action)).toContain('automation.a1_lead_closed_won');
  });

  it('does NOT open a second handover when one already exists', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      project_handovers: [{ id: 'h1', project_id: 'p1', status: 'in_progress' }],
    });
    await onLeadClosedWon(db, evt());
    expect(db.tables.project_handovers).toHaveLength(1);
    expect(audits[0].newValue).toMatchObject({ handoverCreated: false });
  });

  it('does not duplicate the follow-up if one is already there (re-run safe)', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      customer_follow_ups: [{ id: 'f1', project_id: 'p1', note: 'First finalization meeting — STW 460', deleted_at: null }],
    });
    await onLeadClosedWon(db, evt());
    expect(db.tables.customer_follow_ups).toHaveLength(1);
  });

  it('skips the follow-up when no customer is linked, but still opens the handover', async () => {
    const db = fakeDb({ projects: [{ ...PROJECT, customer_id: null }] });
    await onLeadClosedWon(db, evt());
    expect(db.tables.customer_follow_ups).toHaveLength(0);
    expect(db.tables.project_handovers).toHaveLength(1);
  });

  it('does not notify the actor about their own action', async () => {
    const db = fakeDb({ projects: [PROJECT] });
    await onLeadClosedWon(db, evt({ actor_id: 'tpm' }));
    expect(db.tables.notifications.map((n: any) => n.user_id)).toEqual(['trpm']);
  });

  it('does nothing when the project cannot be loaded', async () => {
    const db = fakeDb({ projects: [] });
    await onLeadClosedWon(db, evt());
    expect(db.tables.project_handovers).toHaveLength(0);
    expect(db.tables.notifications).toHaveLength(0);
  });
});

describe('A2 — handover ready', () => {
  it('nudges the PMs and NEVER advances the stage', async () => {
    const db = fakeDb({ projects: [PROJECT] });
    await onHandoverReady(db, evt({ event_type: 'handover.ready', entity_table: 'project_handovers' }));

    expect(db.tables.notifications).toHaveLength(2);
    expect(db.tables.notifications[0].body).toContain('ready to move to Finalization');
    expect(db.tables.notifications[0].link).toBe('/projects/p1/finalization');

    const a = audits.find(x => x.action === 'automation.a2_handover_ready');
    expect(a?.newValue).toMatchObject({ stageForced: false });
    expect(db.tables.projects[0]).not.toHaveProperty('current_stage');
  });
});

describe('A5 — items are ready', () => {
  const itemsReady = evt({ event_type: 'project.items_ready', entity_table: 'projects', entity_id: 'p1', actor_id: null });

  it('notifies + e-mails the T-Lines PM, and asks for a delivery plan when none exists', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: [{ id: 'tpm', full_name: 'Dana', email: 'dana@t-lines.com' }],
      delivery_plans: [],
    });
    await onProjectItemsReady(db, itemsReady);

    expect(db.tables.notifications.map((n: any) => n.user_id).sort()).toEqual(['tpm', 'trpm']);
    expect(db.tables.notifications[0].title).toBe('Items are ready: STW 460');
    expect(db.tables.notifications[0].body).toContain('No delivery plan exists yet');

    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe('dana@t-lines.com');
    expect(emails[0].subject).toBe('Items are ready — STW 460');
    expect(emails[0].html).toContain('no delivery plan yet');
  });

  it('drops the delivery-plan nudge when a plan already exists', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: [{ id: 'tpm', full_name: 'Dana', email: 'dana@t-lines.com' }],
      delivery_plans: [{ id: 'dp1', project_id: 'p1' }],
    });
    await onProjectItemsReady(db, itemsReady);
    expect(db.tables.notifications[0].body).not.toContain('No delivery plan');
    expect(db.tables.notifications[0].body).toContain('ready for delivery');
  });

  it('still notifies when delivery_plans does not exist (migration 059 not applied)', async () => {
    const db = fakeDb(
      { projects: [PROJECT], profiles: [{ id: 'tpm', full_name: 'Dana', email: 'dana@t-lines.com' }] },
      { missingTables: ['delivery_plans'] },
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(onProjectItemsReady(db, itemsReady)).resolves.toBeUndefined();
    expect(db.tables.notifications).toHaveLength(2);
    expect(emails).toHaveLength(1);
    warn.mockRestore();
  });

  it('respects the notify.* permission — no permission, no e-mail (but still in-app)', async () => {
    permitted = false;
    const db = fakeDb({
      projects: [PROJECT],
      profiles: [{ id: 'tpm', full_name: 'Dana', email: 'dana@t-lines.com' }],
    });
    await onProjectItemsReady(db, itemsReady);
    expect(emails).toHaveLength(0);
    expect(db.tables.notifications).toHaveLength(2);
  });

  it('leaks no price, PF, vendor or margin to the T-Lines PM', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: [{ id: 'tpm', full_name: 'Dana', email: 'dana@t-lines.com' }],
    });
    await onProjectItemsReady(db, itemsReady);

    const seen = JSON.stringify([db.tables.notifications, emails]).toLowerCase();
    for (const forbidden of ['pf_usd', 'pf_tl', 'vendor', 'margin', 'cost', 'price', 'invoice', 'expense']) {
      expect(seen).not.toContain(forbidden);
    }
  });
});

describe('allItemsSent — the A5 trigger', () => {
  it('is true only when every item is SENT', () => {
    expect(allItemsSent([{ status: 'SENT' }, { status: 'SENT' }])).toBe(true);
    expect(allItemsSent([{ status: 'SENT' }, { status: 'READY' }])).toBe(false);
    expect(allItemsSent([{ status: 'PARTIAL_SENT' }])).toBe(false);
    expect(allItemsSent([{ status: 'HOLD_T' }, { status: 'SENT' }])).toBe(false);
  });

  it('an EMPTY project is NOT ready — [].every() would say yes, which is nonsense', () => {
    expect(allItemsSent([])).toBe(false);
  });
});

describe('recipientsOf', () => {
  it('drops nulls, duplicates and the actor', () => {
    expect(recipientsOf(['a', null, 'a', undefined, 'b'], 'b')).toEqual(['a']);
    expect(recipientsOf([null, undefined])).toEqual([]);
  });
});
