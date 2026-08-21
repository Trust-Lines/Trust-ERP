import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onApprovalReminder } from '@/lib/events/handlers';
import { handlersFor } from '@/lib/events/bus';
import { NOTIFY_MATRIX, ruleFor } from '@/lib/notify/matrix';
import { staleApprovals, daysWaiting, reminderDedupeKey, STALE_APPROVAL_DAYS, type PendingApproval } from '@/lib/approvals/reminders';
import type { SystemEvent } from '@/lib/events/types';
import '@/lib/events';

const audits: { action: string; newValue?: unknown }[] = [];
vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async (p: { action: string; newValue?: unknown }) => { audits.push(p); }),
}));
const emails: { to: string; subject: string }[] = [];
vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn(async (to: string, subject: string) => { emails.push({ to, subject }); }),
}));
vi.mock('@/lib/permissions/server', () => ({ userCan: vi.fn(async () => true) }));

function fakeDb(seed: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { projects: [], notifications: [], profiles: [], ...seed };
  return {
    tables,
    from(table: string) {
      const eqs: [string, any][] = [];
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => { eqs.push([c, v]); return q; },
        is: (c: string, v: any) => { eqs.push([c, v]); return q; },
        in: () => q,
        limit: () => q,
        rows: () => (tables[table] ?? []).filter(r => eqs.every(([c, v]) => r[c] === v)),
        maybeSingle: async () => ({ data: q.rows()[0] ?? null, error: null }),
        single: async () => ({ data: q.rows()[0] ?? null, error: null }),
        insert: async (payload: any) => {
          for (const r of (Array.isArray(payload) ? payload : [payload])) tables[table].push(r);
          return { data: null, error: null };
        },
      };
      return q;
    },
  } as any;
}

const PROJECT = { id: 'p1', code: 'STW 460', name: 'Fifth Avenue Store', tlines_pm_id: 'tpm', trustlines_pm_id: 'trpm', customer_id: null };

const approval = (over: Partial<PendingApproval> = {}): PendingApproval => ({
  id: 'a1', project_id: 'p1', document_id: 'd1', doc_type: 'po_bo',
  assigned_to: 'signer', status: 'pending', created_at: '2026-07-01T00:00:00Z',
  ...over,
});

beforeEach(() => { audits.length = 0; emails.length = 0; });

describe('staleApprovals — the 3-day rule', () => {
  const now = new Date('2026-07-14T12:00:00Z');

  it('counts WHOLE days — 2.9 days is not yet 3', () => {
    expect(daysWaiting('2026-07-11T13:00:00Z', now)).toBe(2);
    expect(daysWaiting('2026-07-11T12:00:00Z', now)).toBe(3);
    expect(daysWaiting('2026-07-14T12:00:00Z', now)).toBe(0);
  });

  it('nudges only what has waited long enough', () => {
    const rows = [
      approval({ id: 'old', created_at: '2026-07-01T00:00:00Z' }),
      approval({ id: 'edge', created_at: '2026-07-11T12:00:00Z' }),
      approval({ id: 'fresh', created_at: '2026-07-13T00:00:00Z' }),
    ];
    expect(staleApprovals(rows, now).map(s => s.approval.id)).toEqual(['old', 'edge']);
    expect(STALE_APPROVAL_DAYS).toBe(3);
  });

  it('skips an UNASSIGNED approval — there is nobody to remind', () => {
    expect(staleApprovals([approval({ assigned_to: null })], now)).toEqual([]);
  });

  it('skips anything not still pending', () => {
    expect(staleApprovals([approval({ status: 'approved' })], now)).toEqual([]);
    expect(staleApprovals([approval({ status: 'waiting' })], now)).toEqual([]);
  });

  it('survives a malformed timestamp instead of throwing', () => {
    expect(daysWaiting('not-a-date', now)).toBe(0);
    expect(staleApprovals([approval({ created_at: 'not-a-date' })], now)).toEqual([]);
  });
});

describe('reminderDedupeKey — at most one nudge per signer per day', () => {
  it('is stable across the SAME day, so a second run today changes nothing', () => {
    const morning = reminderDedupeKey('a1', new Date('2026-07-14T08:00:00'));
    const evening = reminderDedupeKey('a1', new Date('2026-07-14T23:59:00'));
    expect(morning).toBe(evening);
    expect(morning).toBe('approval.reminder:a1:2026-07-14');
  });

  it('CHANGES on a new day, so the nudge repeats daily until it is signed', () => {
    expect(reminderDedupeKey('a1', new Date('2026-07-14T08:00:00')))
      .not.toBe(reminderDedupeKey('a1', new Date('2026-07-15T08:00:00')));
  });

  it('is per-approval, so two stale approvals both get their own reminder', () => {
    const d = new Date('2026-07-14T08:00:00');
    expect(reminderDedupeKey('a1', d)).not.toBe(reminderDedupeKey('a2', d));
  });

});

describe('A9 — approval reminder', () => {
  const evt = (payload: Record<string, unknown>): SystemEvent => ({
    id: 'e1', event_type: 'approval.reminder', project_id: 'p1', lead_id: null,
    entity_table: 'document_approvals', entity_id: 'a1', actor_id: null,
    payload, dedupe_key: 'approval.reminder:a1:2026-07-14',
    created_at: '2026-07-14T00:00:00Z', processed_at: null,
  });

  it('nudges the ASSIGNED signer only — not a role, not the PMs', () => {
    expect(NOTIFY_MATRIX['approval.reminder'].roles).toEqual([]);
    expect(NOTIFY_MATRIX['approval.reminder'].projectRoles).toEqual([]);
  });

  it('notifies and e-mails the signer', async () => {
    const db = fakeDb({
      projects: [PROJECT],
      profiles: [{ id: 'signer', full_name: 'Sam', email: 'sam@trust.com', is_active: true }],
    });
    await onApprovalReminder(db, evt({ assigneeId: 'signer', docLabel: 'PO-123.pdf', waitingDays: 5 }));

    expect(db.tables.notifications).toHaveLength(1);
    expect(db.tables.notifications[0].user_id).toBe('signer');
    expect(db.tables.notifications[0].body).toContain('5 days');
    expect(db.tables.notifications[0].link).toBe('/approvals');

    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe('sam@trust.com');
    expect(audits.map(a => a.action)).toContain('automation.a9_approval_reminder');
  });

  it('does nothing without an assignee', async () => {
    const db = fakeDb({ projects: [PROJECT] });
    await onApprovalReminder(db, evt({ docLabel: 'PO-123.pdf' }));
    expect(db.tables.notifications).toHaveLength(0);
  });
});

describe('A8 / A10 — no double notification', () => {
  it('review.decision and design.* have NO handler registered, on purpose', () => {
    expect(handlersFor('review.decision')).toEqual([]);
    expect(handlersFor('design.version_submitted')).toEqual([]);
    expect(handlersFor('design.revision_requested')).toEqual([]);
  });

  it('and they carry no notify rule either', () => {
    expect(ruleFor('review.decision')).toBeNull();
    expect(ruleFor('design.version_submitted')).toBeNull();
  });

  it('while the events that SHOULD notify do have a handler', () => {
    for (const type of ['lead.closed_won', 'handover.ready', 'project.items_ready',
                        'site.ready', 'po.chain_complete', 'container.arrived',
                        'change_request.approved', 'approval.reminder'] as const) {
      expect(handlersFor(type), type).toHaveLength(1);
    }
  });
});

describe('notify matrix', () => {
  it('e-mails only where an e-mail is actually wanted', () => {
    const withEmail = Object.entries(NOTIFY_MATRIX).filter(([, r]) => r.emailPerm).map(([k]) => k).sort();
    expect(withEmail).toEqual(['approval.reminder', 'project.items_ready']);
    expect(NOTIFY_MATRIX['project.items_ready'].emailPerm).toBe('notify.ready');
    expect(NOTIFY_MATRIX['approval.reminder'].emailPerm).toBe('notify.approval_request');
  });

  it('gives A4 two audiences: a missing vendor is the production manager’s problem', () => {
    expect(NOTIFY_MATRIX['po.vendor_needed'].roles).toContain('production_manager');
    expect(NOTIFY_MATRIX['po.chain_complete'].roles).toEqual([]);
  });

  it('routes site readiness to logistics', () => {
    expect(NOTIFY_MATRIX['site.ready'].roles).toEqual(['logistics']);
  });

  it('never puts tlines_pm on an internal-supply event', () => {
    expect(NOTIFY_MATRIX['po.vendor_needed'].projectRoles).not.toContain('tlines_pm_id');
    expect(NOTIFY_MATRIX['change_request.approved'].projectRoles).not.toContain('tlines_pm_id');
  });

  it('an unknown event notifies nobody rather than guessing', () => {
    expect(ruleFor('something.new')).toBeNull();
  });
});
