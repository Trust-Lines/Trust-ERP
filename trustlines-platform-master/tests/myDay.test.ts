import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildMyDay, sectionsForRole, SECTIONS_FOR_ROLE, PRICEY_SECTIONS, type SectionKey,
} from '@/lib/dashboard/myDay';

describe('sectionsForRole — price safety is structural', () => {
  const EXTERNAL = ['tlines_pm', 'designer', 'sales_rep', 'sales_marketing_manager'];

  it('NEVER gives an external role a pricey section — in the table OR after filtering', () => {
    for (const role of EXTERNAL) {
      for (const key of SECTIONS_FOR_ROLE[role] ?? []) {
        expect(PRICEY_SECTIONS.has(key), `${role} declares pricey ${key}`).toBe(false);
      }
      for (const key of sectionsForRole(role)) {
        expect(PRICEY_SECTIONS.has(key), `${role} resolves to pricey ${key}`).toBe(false);
      }
    }
  });

  it('tlines_pm specifically gets no vendor / payment / invoice row', () => {
    const keys = sectionsForRole('tlines_pm');
    expect(keys).not.toContain('vendor_needed');
    expect(keys).not.toContain('waiting_payment');
    expect(keys).not.toContain('unpaid_invoices');
    expect(keys).not.toContain('items_on_hold');
    expect(keys).toEqual(expect.arrayContaining(['overdue_followups', 'site_not_ready', 'open_crs']));
  });

  it('internal roles keep their pricey sections', () => {
    expect(sectionsForRole('production_manager')).toContain('vendor_needed');
    expect(sectionsForRole('accounting')).toEqual(expect.arrayContaining(['unpaid_invoices', 'waiting_payment']));
  });

  it('everyone — even an unknown or null role — gets signatures + notifications, nothing pricey', () => {
    for (const role of ['nonsense_role', null, undefined, '']) {
      const keys = sectionsForRole(role as string | null | undefined);
      expect(keys).toContain('signatures');
      expect(keys).toContain('notifications');
      expect(keys.some(k => PRICEY_SECTIONS.has(k))).toBe(false);
    }
  });

  it('a defensively-broken table (pricey section on an external role) is still filtered out', () => {
    const withInjected = ['signatures', 'vendor_needed'] as SectionKey[];
    const filtered = withInjected.filter(k => !PRICEY_SECTIONS.has(k));
    expect(filtered).toEqual(['signatures']);
  });
});

function todayIsoForTest(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIsoForTest(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fakeDb(seed: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    document_approvals: [], notifications: [], projects: [], site_readiness: [],
    change_requests: [], production_items: [], containers: [], sales_design_jobs: [],
    supplier_invoices: [], customer_follow_ups: [], profiles: [], prospects: [],
    project_assignments: [], qc_checklists: [], ...seed,
  };
  return {
    tables,
    from(table: string) {
      const eqs: [string, any][] = [];
      let inFilter: [string, any[]] | null = null;
      let notIn: [string, any[]] | null = null;
      let lt: [string, any] | null = null;
      let orConds: [string, any][] | null = null;
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => { eqs.push([c, v]); return q; },
        is: (c: string, v: any) => { eqs.push([c, v]); return q; },
        lt: (c: string, v: any) => { lt = [c, v]; return q; },
        in: (c: string, v: any[]) => { inFilter = [c, v]; return q; },
        not: (c: string, _op: string, v: string) => { notIn = [c, v.replace(/[()]/g, '').split(',')]; return q; },
        or: (expr: string) => {
          orConds = expr.split(',').map(clause => {
            const [col, , ...rest] = clause.split('.');
            return [col, rest.join('.')] as [string, any];
          });
          return q;
        },
        order: () => q,
        limit: () => q,
        rows() {
          return (tables[table] ?? []).filter(r =>
            eqs.every(([c, v]) => r[c] === v) &&
            (!inFilter || inFilter[1].includes(r[inFilter[0]])) &&
            (!notIn || !notIn[1].includes(r[notIn[0]])) &&
            (!lt || r[lt[0]] < lt[1]) &&
            (!orConds || orConds.some(([c, v]) => String(r[c]) === String(v))));
        },
        then(res: any) { return Promise.resolve({ data: q.rows(), error: null }).then(res); },
        single: async () => ({ data: q.rows()[0] ?? null, error: null }),
        maybeSingle: async () => ({ data: q.rows()[0] ?? null, error: null }),
      };
      return q;
    },
  } as any;
}

beforeEach(() => vi.restoreAllMocks());

describe('buildMyDay', () => {
  it('assembles only the sections the role allows', async () => {
    const db = fakeDb();
    const my = await buildMyDay(db, 'u1', 'logistics');
    const keys = my.sections.map(s => s.key);
    expect(keys).toEqual(['signatures', 'notifications', 'open_containers']);
    expect(my.role).toBe('logistics');
  });

  it('fills the signature + notification sections from real rows', async () => {
    const db = fakeDb({
      document_approvals: [
        { id: 'a1', assigned_to: 'u1', status: 'pending', project_id: 'p1', doc_type: 'po_bo' },
        { id: 'a2', assigned_to: 'u1', status: 'pending', project_id: 'p2', doc_type: 'pf' },
        { id: 'a3', assigned_to: 'other', status: 'pending', project_id: 'p1', doc_type: 'pf' },
      ],
      notifications: [
        { id: 'n1', user_id: 'u1', is_read: false, title: 'Items are ready: STW 460', link: '/projects/p1/delivery', created_at: '2026-07-14' },
      ],
    });
    const my = await buildMyDay(db, 'u1', 'general_manager');
    const sig = my.sections.find(s => s.key === 'signatures')!;
    expect(sig.items[0].badge).toBe('2');
    const notif = my.sections.find(s => s.key === 'notifications')!;
    expect(notif.items).toHaveLength(1);
    expect(notif.items[0].label).toContain('Items are ready');
  });

  it('a tlines_pm My Day contains NO price/vendor/payment row, even with such data present', async () => {
    const db = fakeDb({
      projects: [{ id: 'p1', code: 'STW 460', name: 'X', tlines_pm_id: 'u1', is_archived: false }],
      production_items: [
        { id: 'i1', type: 'Millwork', project_id: 'p1', source: 'project', vendor_id: null, po_sign_status: 'SIGNED', status: 'NOT_ORDERED', deleted_at: null },
        { id: 'i2', type: 'Ceiling', project_id: 'p1', source: 'project', vendor_id: 'v', status: 'WAITING_PAYMENT', deleted_at: null },
        { id: 'i3', type: 'Image', project_id: 'p1', source: 'project', vendor_id: 'v', status: 'HOLD_T', deleted_at: null },
      ],
      supplier_invoices: [{ id: 'inv1', invoice_number: 'INV-1', project_id: 'p1', status: 'unpaid', deleted_at: null }],
      customer_follow_ups: [{ id: 'f1', assignee_id: 'u1', status: 'open', due_date: '2020-01-01', note: 'Call the client', project_id: 'p1' }],
      site_readiness: [{ project_id: 'p1', overall_status: 'not_ready' }],
    });
    const my = await buildMyDay(db, 'u1', 'tlines_pm');
    const keys = my.sections.map(s => s.key);

    expect(keys).not.toContain('vendor_needed');
    expect(keys).not.toContain('waiting_payment');
    expect(keys).not.toContain('unpaid_invoices');
    expect(keys).not.toContain('items_on_hold');

    expect(my.sections.find(s => s.key === 'overdue_followups')!.items[0].label).toBe('Call the client');
    expect(my.sections.find(s => s.key === 'site_not_ready')!.items[0].label).toBe('STW 460');

    const serialised = JSON.stringify(my).toLowerCase();
    for (const forbidden of ['vendor', 'waiting_payment', 'invoice', 'pf_usd', 'margin', 'hold']) {
      expect(serialised, `leaked "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('a production_manager DOES get the vendor + hold sections', async () => {
    const db = fakeDb({
      production_items: [
        { id: 'i1', type: 'Millwork', project_id: 'p1', source: 'project', vendor_id: null, po_sign_status: 'SIGNED', status: 'NOT_ORDERED', deleted_at: null },
        { id: 'i3', type: 'Image', project_id: 'p1', source: 'project', vendor_id: 'v', status: 'HOLD_T', deleted_at: null },
      ],
    });
    const my = await buildMyDay(db, 'u1', 'production_manager');
    expect(my.sections.find(s => s.key === 'vendor_needed')!.items).toHaveLength(1);
    expect(my.sections.find(s => s.key === 'items_on_hold')!.items).toHaveLength(1);
  });

  it('a failing section degrades to empty instead of blanking the dashboard', async () => {
    const db = fakeDb();
    const orig = db.from.bind(db);
    db.from = (t: string) => {
      if (t === 'notifications') throw new Error('boom');
      return orig(t);
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const my = await buildMyDay(db, 'u1', 'ops_manager');
    const notif = my.sections.find(s => s.key === 'notifications')!;
    expect(notif.items).toEqual([]);
    expect(my.sections.find(s => s.key === 'signatures')).toBeTruthy();
  });
});

describe('role coverage (Phase 11.5)', () => {
  const ROLES_WITH_WORK = [
    'design_lead', 'shop_drawer', 'supply_manager', 'supply_user',
    'production_user', 'warehouse_manager', 'warehouse_user', 'qc_responsible', 'project_manager',
  ];

  it('gives every worked role a section beyond signatures + notifications', () => {
    for (const role of ROLES_WITH_WORK) {
      const keys = sectionsForRole(role);
      const extra = keys.filter(k => k !== 'signatures' && k !== 'notifications');
      expect(extra.length, `${role} has no real task source`).toBeGreaterThan(0);
    }
  });

  it('surfaces the 11.3 "assigned to me" slots for the roles that hold them', () => {
    for (const role of ['designer', 'shop_drawer', 'supply_manager', 'warehouse_manager', 'qc_responsible']) {
      expect(sectionsForRole(role), role).toContain('assigned_to_me');
    }
  });

  it('the new sections are NOT pricey — directory/QC data, no money', () => {
    expect(PRICEY_SECTIONS.has('assigned_to_me' as SectionKey)).toBe(false);
    expect(PRICEY_SECTIONS.has('qc_queue' as SectionKey)).toBe(false);
  });
});

describe('Marketing My Day', () => {
  const MARKETING_ROLES = ['marketing_pr', 'marketing_manager'];
  const MARKETING_KEYS: SectionKey[] = ['prospects_assigned', 'potentials_due', 'nurture_overdue', 'handoffs_waiting'];

  it('both Marketing roles get all four sections', () => {
    for (const role of MARKETING_ROLES) {
      const keys = sectionsForRole(role);
      for (const k of MARKETING_KEYS) expect(keys, `${role} missing ${k}`).toContain(k);
    }
  });

  it('none of the Marketing sections are pricey — the module has no PF/vendor/margin surface at all', () => {
    for (const k of MARKETING_KEYS) expect(PRICEY_SECTIONS.has(k)).toBe(false);
  });

  it('handoffs_waiting (Phase 00.5) shows only MY Opportunities Sales sent back, with a reason', async () => {
    const db = fakeDb({
      opportunities: [
        { id: 'o1', prospect_id: 'p1', title: 'Returned to me', marketing_owner_id: 'u1', stage: 'marketing_qualification', return_reason: 'Budget unclear', deleted_at: null },
        { id: 'o2', prospect_id: 'p2', title: 'Not returned', marketing_owner_id: 'u1', stage: 'sales_accepted', return_reason: null, deleted_at: null },
        { id: 'o3', prospect_id: 'p3', title: 'Returned but not mine', marketing_owner_id: 'other', stage: 'marketing_qualification', return_reason: 'No budget', deleted_at: null },
      ],
    });
    const my = await buildMyDay(db, 'u1', 'marketing_pr');
    const section = my.sections.find(s => s.key === 'handoffs_waiting')!;
    const labels = section.items.map(i => i.label);
    expect(labels).toContain('Returned to me');
    expect(labels).not.toContain('Not returned');
    expect(labels).not.toContain('Returned but not mine');
    expect(section.items[0].sublabel).toMatch(/^Returned by Sales: /);
  });

  it('potentials_due (Phase 00.4) shows only MY open Potentials due today or within the next 7 days', async () => {
    const db = fakeDb({
      prospect_potentials: [
        { id: 'pot1', prospect_id: 'p1', title: 'Due today', assigned_to: 'u1', status: 'identified', target_contact_date: todayIsoForTest(), deleted_at: null },
        { id: 'pot2', prospect_id: 'p2', title: 'Due in 3 days', assigned_to: 'u1', status: 'nurture', target_contact_date: addDaysIsoForTest(3), deleted_at: null },
        { id: 'pot3', prospect_id: 'p3', title: 'Due in 30 days (too far)', assigned_to: 'u1', status: 'identified', target_contact_date: addDaysIsoForTest(30), deleted_at: null },
        { id: 'pot4', prospect_id: 'p4', title: 'Overdue', assigned_to: 'u1', status: 'identified', target_contact_date: addDaysIsoForTest(-5), deleted_at: null },
        { id: 'pot5', prospect_id: 'p5', title: 'Not mine', assigned_to: 'other', status: 'identified', target_contact_date: todayIsoForTest(), deleted_at: null },
        { id: 'pot6', prospect_id: 'p6', title: 'Mine but converted', assigned_to: 'u1', status: 'converted', target_contact_date: todayIsoForTest(), deleted_at: null },
      ],
    });
    const my = await buildMyDay(db, 'u1', 'marketing_pr');
    const section = my.sections.find(s => s.key === 'potentials_due')!;
    const labels = section.items.map(i => i.label);
    expect(labels).toContain('Due today');
    expect(labels).toContain('Due in 3 days');
    expect(labels).not.toContain('Due in 30 days (too far)');
    expect(labels).not.toContain('Overdue');
    expect(labels).not.toContain('Not mine');
    expect(labels).not.toContain('Mine but converted');
    expect(section.items[0].href).toMatch(/^\/marketing\/prospects\//);
  });

  it('nurture_overdue (Phase 00.4) shows only MY open Potentials whose target date has passed', async () => {
    const db = fakeDb({
      prospect_potentials: [
        { id: 'pot1', prospect_id: 'p1', title: 'Overdue by 5 days', assigned_to: 'u1', status: 'identified', target_contact_date: addDaysIsoForTest(-5), deleted_at: null },
        { id: 'pot2', prospect_id: 'p2', title: 'Due today (not overdue)', assigned_to: 'u1', status: 'identified', target_contact_date: todayIsoForTest(), deleted_at: null },
        { id: 'pot3', prospect_id: 'p3', title: 'Overdue but lost', assigned_to: 'u1', status: 'lost', target_contact_date: addDaysIsoForTest(-5), deleted_at: null },
      ],
    });
    const my = await buildMyDay(db, 'u1', 'marketing_pr');
    const section = my.sections.find(s => s.key === 'nurture_overdue')!;
    const labels = section.items.map(i => i.label);
    expect(labels).toContain('Overdue by 5 days');
    expect(labels).not.toContain('Due today (not overdue)');
    expect(labels).not.toContain('Overdue but lost');
    expect(section.items[0].tone).toBe('danger');
  });

  it('prospects_assigned (Phase 00.3) returns MY Prospects only — created, owned, or assigned', async () => {
    const db = fakeDb({
      prospects: [
        { id: 'p1', organization_name: 'Acme Retail', status: 'captured', created_by: 'u1', assigned_marketing_user_id: null, owner_id: null, is_archived: false, deleted_at: null },
        { id: 'p2', organization_name: 'Owned Co', status: 'nurture', created_by: 'other', assigned_marketing_user_id: null, owner_id: 'u1', is_archived: false, deleted_at: null },
        { id: 'p3', organization_name: 'Someone Else Inc', status: 'captured', created_by: 'other', assigned_marketing_user_id: 'other', owner_id: 'other', is_archived: false, deleted_at: null },
        { id: 'p4', organization_name: 'Archived Co', status: 'captured', created_by: 'u1', assigned_marketing_user_id: null, owner_id: null, is_archived: true, deleted_at: null },
      ],
    });
    const my = await buildMyDay(db, 'u1', 'marketing_pr');
    const section = my.sections.find(s => s.key === 'prospects_assigned')!;
    const labels = section.items.map(i => i.label);
    expect(labels).toContain('Acme Retail');
    expect(labels).toContain('Owned Co');
    expect(labels).not.toContain('Someone Else Inc');
    expect(labels).not.toContain('Archived Co');
    expect(section.items[0].href).toMatch(/^\/marketing\/prospects\//);
  });

  it('prospects_assigned degrades to the pending note if migration 072 is not applied (table missing)', async () => {
    const db = fakeDb();
    db.from = (table: string) => {
      if (table === 'prospects') throw new Error('relation "prospects" does not exist');
      return fakeDb().from(table);
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const my = await buildMyDay(db, 'u1', 'marketing_pr');
    const section = my.sections.find(s => s.key === 'prospects_assigned')!;
    expect(section.items).toEqual([]);
  });

  it('a marketing_manager gets the identical section set (scope difference is enforced by RLS, not My Day)', () => {
    expect(sectionsForRole('marketing_manager')).toEqual(sectionsForRole('marketing_pr'));
  });
});

describe('buildAssignedToMe + buildQcSection', () => {
  it('shows projects that match MY skills, not projects for skills I lack', async () => {
    const db = fakeDb({
      profiles: [{ id: 'me', skills: ['millwork'] }],
      projects: [
        { id: 'p1', code: 'STW 460', categories: ['Millwork', 'Image'], is_draft: false, is_archived: false },
        { id: 'p2', code: 'STW 999', categories: ['Ceiling'], is_draft: false, is_archived: false },
      ],
    });
    const my = await buildMyDay(db, 'me', 'supply_manager');
    const sec = my.sections.find(s => s.key === 'assigned_to_me')!;
    expect(sec.items).toHaveLength(1);
    expect(sec.items[0].label).toBe('STW 460');
    expect(sec.items[0].sublabel).toBe('needs millwork');
    expect(sec.items[0].href).toBe('/projects/p1');
  });

  it('shows nothing when I have no skills set', async () => {
    const db = fakeDb({
      profiles: [{ id: 'me', skills: [] }],
      projects: [{ id: 'p1', code: 'STW 460', categories: ['Millwork'], is_draft: false, is_archived: false }],
    });
    const my = await buildMyDay(db, 'me', 'supply_manager');
    expect(my.sections.find(s => s.key === 'assigned_to_me')!.items).toEqual([]);
  });

  it('QC section counts ready items and my open inspections, reusing the queue derivation', async () => {
    const db = fakeDb({
      production_items: [
        { id: 'i1', project_id: 'p1', type: 'Millwork', status: 'RECEIVED', deleted_at: null },
        { id: 'i2', project_id: 'p1', type: 'Ceiling', status: 'RECEIVED', deleted_at: null },
      ],
      qc_checklists: [
        { id: 'q1', project_id: 'p1', production_item_id: 'i2', overall_result: 'pending', conducted_by: 'me', conducted_at: '2026-07-16', rework_of_id: null, deleted_at: null },
      ],
    });
    const my = await buildMyDay(db, 'me', 'qc_responsible');
    const sec = my.sections.find(s => s.key === 'qc_queue')!;
    expect(sec.items.some(x => /ready for inspection/.test(x.label))).toBe(true);
    expect(sec.items.some(x => /finish your inspection/.test(x.label))).toBe(true);
  });
});
