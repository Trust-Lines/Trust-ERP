import { describe, it, expect } from 'vitest';
import { runClassificationForNeed } from '@/lib/marketing/opportunityEngine';

function fakeAdmin(opts: {
  need: Record<string, unknown>;
  prospect: Record<string, unknown>;
  existingOpp?: Record<string, unknown> | null;
  existingPotential?: Record<string, unknown> | null;
  oppWriteResult?: Record<string, unknown>;
  potentialWriteResult?: Record<string, unknown>;
  hasDocumentEvidence?: boolean;
}) {
  const calls: { table: string; op: string; patch?: unknown }[] = [];

  function chain(table: string) {
    let eqField: string | null = null;
    const c: {
      select: () => typeof c; eq: (f: string) => typeof c; is: () => typeof c; not: () => typeof c;
      limit: () => typeof c;
      update: (p: unknown) => typeof c; insert: (r: unknown) => typeof c;
      maybeSingle: () => Promise<{ data: unknown }>; then: (resolve: (v: { data: unknown }) => void) => void;
    } = {
      select: () => c,
      eq: (f: string) => { eqField = f; return c; },
      is: () => c,
      not: () => c,
      limit: () => c,
      update: (patch: unknown) => { calls.push({ table, op: 'update', patch }); return c; },
      insert: (row: unknown) => { calls.push({ table, op: 'insert', patch: row }); return c; },
      maybeSingle: async () => resolve(),
      then: (r) => r(resolve()),
    };
    function lastOp() { return [...calls].reverse().find(x => x.table === table); }
    function resolve(): { data: unknown } {
      if (table === 'prospect_needs') return eqField === 'prospect_id' ? { data: [] } : { data: opts.need };
      if (table === 'prospects') return { data: opts.prospect };
      if (table === 'prospect_need_documents') return { data: opts.hasDocumentEvidence ? [{ id: 'doc-x' }] : [] };
      if (table === 'opportunities') {
        const op = lastOp();
        if (op?.op === 'insert' || op?.op === 'update') return { data: opts.oppWriteResult ?? { id: 'opp-x' } };
        return { data: opts.existingOpp ?? null };
      }
      if (table === 'prospect_potentials') {
        const op = lastOp();
        if (op?.op === 'insert' || op?.op === 'update') return { data: opts.potentialWriteResult ?? { id: 'pot-x' } };
        return { data: opts.existingPotential ?? null };
      }
      return { data: null };
    }
    return c;
  }

  return { admin: { from: (t: string) => chain(t) } as any, calls };
}

const baseProspect = { display_name: 'ZZTEST Acme', owner_id: 'u1', assigned_marketing_user_id: null };
const baseNeed = {
  id: 'n1', prospect_id: 'p1', location_id: null, title: 'Manhattan Remodel',
  project_types: [], has_active_project: null, deadline: null, expected_start_date: null,
  layout_available: null, timing: null, source: 'event',
};

describe('runClassificationForNeed — per-Need, not per-Prospect', () => {
  it('writes classification_reasons as a real array onto the Need, never a JSON string', async () => {
    const need = { ...baseNeed, has_active_project: true };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp: null, existingPotential: null, hasDocumentEvidence: true });

    await runClassificationForNeed(admin, 'n1', 'u1');

    const needUpdate = calls.find(c => c.table === 'prospect_needs' && c.op === 'update');
    const reasons = (needUpdate!.patch as Record<string, unknown>).classification_reasons;
    expect(Array.isArray(reasons)).toBe(true);
    expect(typeof reasons).not.toBe('string');
  });

  it('a qualifying Need gets exactly one Opportunity created, linked by need_id', async () => {
    const need = { ...baseNeed, has_active_project: true };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp: null, existingPotential: null, hasDocumentEvidence: true });

    const result = await runClassificationForNeed(admin, 'n1', 'u1');

    expect(result.needClassification).toBe('opportunity');
    expect(result.opportunityAction).toBe('created');
    const insertCall = calls.find(c => c.table === 'opportunities' && c.op === 'insert');
    expect((insertCall!.patch as Record<string, unknown>).need_id).toBe('n1');
    expect((insertCall!.patch as Record<string, unknown>).auto_managed).toBe(true);
  });

  it('re-running on a still-qualifying Need UPDATES the existing Opportunity, never creates a second one', async () => {
    const need = { ...baseNeed, has_active_project: true };
    const existingOpp = { id: 'opp-1', stage: 'marketing_qualification' };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp, existingPotential: null, hasDocumentEvidence: true });

    const result = await runClassificationForNeed(admin, 'n1', 'u1');

    expect(result.opportunityAction).toBe('updated');
    expect(calls.some(c => c.table === 'opportunities' && c.op === 'insert')).toBe(false);
  });

  it('a Need that no longer qualifies puts its Opportunity on_hold, never deletes it', async () => {
    const need = { ...baseNeed, has_active_project: false, deadline: null, timing: null };
    const existingOpp = { id: 'opp-1', stage: 'marketing_qualification' };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp, existingPotential: null });

    const result = await runClassificationForNeed(admin, 'n1', 'u1');

    expect(result.needClassification).not.toBe('opportunity');
    expect(result.opportunityAction).toBe('put_on_hold');
    const updateCall = calls.find(c => c.table === 'opportunities' && c.op === 'update');
    expect((updateCall!.patch as Record<string, unknown>).stage).toBe('on_hold');
  });

  it('a Need graduating from Potential to Opportunity converts the existing Potential', async () => {
    const need = { ...baseNeed, has_active_project: true };
    const existingPotential = { id: 'pot-1', status: 'identified' };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp: null, existingPotential, hasDocumentEvidence: true });

    const result = await runClassificationForNeed(admin, 'n1', 'u1');

    expect(result.opportunityAction).toBe('created');
    expect(result.potentialAction).toBe('converted');
    const potUpdate = calls.find(c => c.table === 'prospect_potentials' && c.op === 'update');
    expect((potUpdate!.patch as Record<string, unknown>).status).toBe('converted');
  });

  it('a Need with future timing (no active-need signal) creates a Potential, not an Opportunity', async () => {
    const need = { ...baseNeed, timing: '6_12_months' };
    const { admin } = fakeAdmin({ need, prospect: baseProspect, existingOpp: null, existingPotential: null });

    const result = await runClassificationForNeed(admin, 'n1', 'u1');

    expect(result.needClassification).toBe('potential');
    expect(result.potentialAction).toBe('created');
    expect(result.opportunityAction).toBe('none');
  });

  it('honors an explicit target_contact_date on the Need for the resulting Potential', async () => {
    const need = { ...baseNeed, timing: 'contact_later', target_contact_date: '2027-03-15' };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp: null, existingPotential: null });

    await runClassificationForNeed(admin, 'n1', 'u1');

    const insertCall = calls.find(c => c.table === 'prospect_potentials' && c.op === 'insert');
    expect((insertCall!.patch as Record<string, unknown>).target_contact_date).toBe('2027-03-15');
  });

  it('falls back to the rule engine\'s recommended follow-up date when no explicit target_contact_date is set', async () => {
    const need = { ...baseNeed, timing: '6_12_months', target_contact_date: null };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp: null, existingPotential: null });

    await runClassificationForNeed(admin, 'n1', 'u1');

    const insertCall = calls.find(c => c.table === 'prospect_potentials' && c.op === 'insert');
    const date = (insertCall!.patch as Record<string, unknown>).target_contact_date;
    expect(date).not.toBe('2027-03-15');
    expect(typeof date).toBe('string');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('admin_corrected stage lock — 2026-08-07 command-center drag-and-drop', () => {
  it('does not touch stage on an update when the existing Opportunity is admin_corrected', async () => {
    const need = { ...baseNeed, has_active_project: true };
    const existingOpp = { id: 'opp-1', stage: 'negotiation', admin_corrected: true };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp, existingPotential: null, hasDocumentEvidence: true });

    const result = await runClassificationForNeed(admin, 'n1', 'u1');

    expect(result.opportunityAction).toBe('updated');
    const updateCall = calls.find(c => c.table === 'opportunities' && c.op === 'update');
    expect((updateCall!.patch as Record<string, unknown>).stage).toBeUndefined();
    expect((updateCall!.patch as Record<string, unknown>).title).toBeDefined();
  });

  it('does not put an admin_corrected Opportunity on_hold when its Need stops qualifying', async () => {
    const need = { ...baseNeed, has_active_project: false, deadline: null, timing: null };
    const existingOpp = { id: 'opp-1', stage: 'negotiation', admin_corrected: true };
    const { admin, calls } = fakeAdmin({ need, prospect: baseProspect, existingOpp, existingPotential: null });

    const result = await runClassificationForNeed(admin, 'n1', 'u1');

    expect(result.opportunityAction).toBe('none');
    expect(calls.some(c => c.table === 'opportunities' && c.op === 'update')).toBe(false);
  });
});

function makeInMemoryAdmin() {
  const db: Record<string, Record<string, unknown>[]> = { prospects: [], prospect_needs: [], opportunities: [], prospect_potentials: [], prospect_need_documents: [] };
  let idCounter = 1;

  function from(table: string) {
    const rows = db[table] ?? (db[table] = []);
    let filtered = rows;
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;

    const builder: {
      select: () => typeof builder; eq: (f: string, v: unknown) => typeof builder;
      is: (f: string, v: unknown) => typeof builder; not: (f: string, op: string, v: string) => typeof builder;
      limit: (n: number) => typeof builder;
      insert: (r: Record<string, unknown>) => typeof builder; update: (p: Record<string, unknown>) => typeof builder;
      maybeSingle: () => Promise<{ data: unknown }>; single: () => Promise<{ data: unknown }>;
      then: (resolve: (v: { data: unknown }) => void) => void;
    } = {
      select: () => builder,
      eq: (f, v) => { filtered = filtered.filter(r => r[f] === v); return builder; },
      is: (f, v) => { filtered = filtered.filter(r => (v === null ? r[f] == null : r[f] === v)); return builder; },
      not: (f, _op, v) => { const excl = v.replace(/[()]/g, '').split(','); filtered = filtered.filter(r => !excl.includes(r[f] as string)); return builder; },
      limit: (n) => { filtered = filtered.slice(0, n); return builder; },
      insert: (row) => { pendingInsert = { id: `${table}-${idCounter++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row }; return builder; },
      update: (patch) => { pendingUpdate = patch; return builder; },
      maybeSingle: async () => {
        if (pendingInsert) { rows.push(pendingInsert); return { data: pendingInsert }; }
        if (pendingUpdate) { const t = filtered[0]; if (t) Object.assign(t, pendingUpdate); return { data: t ?? null }; }
        return { data: filtered[0] ?? null };
      },
      single: async () => builder.maybeSingle(),
      then: (resolve) => {
        if (pendingInsert) { rows.push(pendingInsert); resolve({ data: pendingInsert }); return; }
        if (pendingUpdate) { filtered.forEach(r => Object.assign(r, pendingUpdate)); resolve({ data: filtered }); return; }
        resolve({ data: filtered });
      },
    };
    return builder;
  }

  return { admin: { from } as any, db };
}

describe('multi-need scenario — one Prospect, two Opportunities + one Potential', () => {
  it('each Need classifies and converts independently, never capped at one Opportunity per Prospect', async () => {
    const { admin, db } = makeInMemoryAdmin();
    db.prospects.push({ id: 'p1', display_name: 'ZZTEST MultiCo', status: 'captured', owner_id: 'u1', assigned_marketing_user_id: null });

    db.prospect_needs.push(
      { id: 'need-a', prospect_id: 'p1', title: 'Manhattan Full Remodel', project_types: [], has_active_project: true, deadline: null, expected_start_date: null, layout_available: null, timing: null, source: 'event' },
      { id: 'need-b', prospect_id: 'p1', title: 'Brooklyn New Construction', project_types: [], has_active_project: null, deadline: '2026-12-01', expected_start_date: null, layout_available: null, timing: null, source: 'event' },
      { id: 'need-c', prospect_id: 'p1', title: 'Queens future expansion', project_types: [], has_active_project: null, deadline: null, expected_start_date: null, layout_available: null, timing: '6_12_months', source: 'event' },
    );
    db.prospect_need_documents.push(
      { id: 'doc-a', need_id: 'need-a', category: 'matterport', url: 'https://matterport.example/a' },
      { id: 'doc-b', need_id: 'need-b', category: 'layout', dropbox_path: '/x/layout.pdf', file_name: 'layout.pdf' },
    );

    await runClassificationForNeed(admin, 'need-a', 'u1');
    await runClassificationForNeed(admin, 'need-b', 'u1');
    await runClassificationForNeed(admin, 'need-c', 'u1');

    expect(db.opportunities).toHaveLength(2);
    expect(new Set(db.opportunities.map(o => o.need_id))).toEqual(new Set(['need-a', 'need-b']));
    expect(db.opportunities.every(o => o.auto_managed === true)).toBe(true);

    expect(db.prospect_potentials).toHaveLength(1);
    expect(db.prospect_potentials[0].need_id).toBe('need-c');

    await runClassificationForNeed(admin, 'need-a', 'u1');
    await runClassificationForNeed(admin, 'need-b', 'u1');
    expect(db.opportunities).toHaveLength(2);

    expect(db.prospects[0].status).toBe('opportunity_candidate');
  });
});
