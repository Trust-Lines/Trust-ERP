
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const k = line.slice(0, line.indexOf('=')); const v = line.slice(line.indexOf('=') + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

import { emitEvent } from '@/lib/events';
import { maybeEmitItemsReady } from '@/lib/events/triggers';
import { deriveLifecycle, redactLifecycleForRole } from '@/lib/lifecycle/projectLifecycle';
import { loadCockpit } from '@/lib/lifecycle/cockpitData';
import { buildMyDay } from '@/lib/dashboard/myDay';

const RUN = !!process.env.SMOKE;

let db: any;
let PM = '';
let CUSTOMER = '';
let projectId = '';
let leadId = '';
const itemIds: string[] = [];

const scan = (obj: unknown) => JSON.stringify(obj).toLowerCase();
const FORBIDDEN = ['pf_usd', 'pf_tl', 'vendor_id', 'margin', 'cost', 'price', 'invoice', 'expense'];
function assertNoLeak(obj: unknown, ctx: string) {
  const s = scan(obj);
  for (const f of FORBIDDEN) expect(s.includes(f), `${ctx} leaked "${f}"`).toBe(false);
}

describe.skipIf(!RUN)('Phase 10 smoke — full chain on the live DB', () => {
  beforeAll(async () => {
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const { data: prof } = await db.from('profiles').select('id').eq('role', 'trustlines_pm').eq('is_active', true).limit(1).single();
    PM = prof.id;
    const { data: cust } = await db.from('customers').select('id').limit(1).single();
    CUSTOMER = cust.id;

    const code = `ZZSMOKE-${Date.now()}`;
    const { data: proj, error } = await db.from('projects').insert({
      code, name: 'Phase 10 Smoke Test', is_draft: true, current_stage: 'closed_deal', current_phase: 'finalization',
      tlines_pm_id: PM, trustlines_pm_id: PM, customer_id: CUSTOMER,
    }).select('id').single();
    if (error) throw error;
    projectId = proj.id;

    const { data: lead } = await db.from('lead_intake').insert({
      project_id: projectId, customer_id: CUSTOMER, opportunity_status: 'new_opportunity', priority: 'medium',
    }).select('id').single();
    leadId = lead.id;
  }, 30000);

  afterAll(async () => {
    if (!db || !projectId) return;
    await db.from('notifications').delete().eq('project_id', projectId);
    await db.from('system_events').delete().eq('project_id', projectId);
    await db.from('customer_follow_ups').delete().eq('project_id', projectId);
    await db.from('change_requests').delete().eq('project_id', projectId);
    await db.from('site_readiness').delete().eq('project_id', projectId);
    await db.from('delivery_plans').delete().eq('project_id', projectId);
    await db.from('project_handovers').delete().eq('project_id', projectId);
    if (itemIds.length) await db.from('production_items').delete().in('id', itemIds);
    await db.from('lead_intake').delete().eq('id', leadId);
    await db.from('projects').delete().eq('id', projectId);
  }, 30000);

  async function lifecycleNow() {
    const { data: p } = await db.from('projects').select('is_draft, delivered_to_trust_at, current_stage').eq('id', projectId).single();
    const { data: h } = await db.from('project_handovers').select('status').eq('project_id', projectId).maybeSingle();
    const { data: s } = await db.from('site_readiness').select('overall_status').eq('project_id', projectId).maybeSingle();
    const { data: cr } = await db.from('change_requests').select('status').eq('project_id', projectId).is('deleted_at', null);
    const { data: it } = await db.from('production_items').select('id, type, status, vendor_id, po_sign_status, pf_sign_status, target_date').eq('project_id', projectId).eq('source', 'project').is('deleted_at', null);
    const { data: ap } = await db.from('document_approvals').select('doc_type').eq('project_id', projectId).eq('status', 'pending');
    const { data: dp } = await db.from('delivery_plans').select('status, customer_accepted').eq('project_id', projectId).maybeSingle();
    return deriveLifecycle({
      project: p,
      handover: h, siteReadiness: s, changeRequests: cr ?? [],
      items: (it ?? []).map((i: Record<string, unknown>) => ({ id: i.id, type: i.type, status: i.status, hasVendor: !!i.vendor_id, poSignStatus: i.po_sign_status, pfSignStatus: i.pf_sign_status, targetDate: i.target_date })),
      pendingApprovals: ap ?? [], deliveryPlan: dp, now: new Date().toISOString().slice(0, 10),
    });
  }

  const notifCount = async () => (await db.from('notifications').select('id', { count: 'exact', head: true }).eq('project_id', projectId)).count ?? 0;
  const eventCount = async (type: string) => (await db.from('system_events').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('event_type', type)).count ?? 0;

  it('starts as a LEAD', async () => {
    expect((await lifecycleNow()).phase).toBe('LEAD');
  });

  it('A1: lead closed won opens the handover, notifies, schedules a follow-up — and is idempotent', async () => {
    await db.from('projects').update({ is_draft: false, delivered_to_trust_at: new Date().toISOString() }).eq('id', projectId);

    const before = await notifCount();
    const e1 = await emitEvent(db, { type: 'lead.closed_won', entityTable: 'lead_intake', entityId: leadId, projectId, leadId, actorId: null });
    expect(e1).not.toBeNull();

    expect((await db.from('project_handovers').select('id').eq('project_id', projectId).maybeSingle()).data).toBeTruthy();
    expect(await notifCount()).toBeGreaterThan(before);
    expect((await db.from('customer_follow_ups').select('id').eq('project_id', projectId)).data?.length).toBeGreaterThan(0);

    const afterFirst = await notifCount();
    const e2 = await emitEvent(db, { type: 'lead.closed_won', entityTable: 'lead_intake', entityId: leadId, projectId, leadId, actorId: null });
    expect(e2).toBeNull();
    expect(await notifCount()).toBe(afterFirst);
    expect(await eventCount('lead.closed_won')).toBe(1);

    expect((await lifecycleNow()).phase).toBe('CLOSED_DEAL');
  });

  it('A2: completing the handover reaches PM_FINALIZATION and nudges (no stage forced)', async () => {
    await db.from('project_handovers').update({ status: 'complete', handover_at: new Date().toISOString() }).eq('project_id', projectId);
    const life = await lifecycleNow();
    expect(life.phase).toBe('PM_FINALIZATION');
    expect(life.blockers.map(b => b.code)).toContain('types_not_defined');

    const before = await notifCount();
    await emitEvent(db, { type: 'handover.ready', entityTable: 'project_handovers', entityId: projectId, projectId, actorId: null });
    expect(await notifCount()).toBeGreaterThan(before);
    const { data: p } = await db.from('projects').select('current_stage').eq('id', projectId).single();
    expect(p.current_stage).toBe('closed_deal');
  });

  it('defining types moves it to SUPPLY_DEVELOPMENT with a vendor next-action', async () => {
    for (const type of ['Millwork', 'Ceiling']) {
      const { data } = await db.from('production_items').insert({
        project_id: projectId, source: 'project', type, status: 'NOT_ORDERED',
        po_sign_status: 'NOT_SIGNED', pf_sign_status: 'NOT_SIGNED',
      }).select('id').single();
      itemIds.push(data.id);
    }
    const life = await lifecycleNow();
    expect(life.phase).toBe('SUPPLY_DEVELOPMENT');
    expect(life.blockers.map(b => b.code)).toContain('vendor_unassigned');
  });

  it('A3: site ready notifies (incl. logistics)', async () => {
    await db.from('site_readiness').insert({ project_id: projectId, overall_status: 'ready', checklist: [] });
    const before = await notifCount();
    await emitEvent(db, { type: 'site.ready', entityTable: 'site_readiness', entityId: projectId, projectId, actorId: null });
    expect(await notifCount()).toBeGreaterThan(before);
  });

  it('A7: an approved change request notifies Supply, with NO budget figure', async () => {
    const { data: cr } = await db.from('change_requests').insert({
      project_id: projectId, title: 'Add wall shelving', status: 'approved', budget_impact: 25000, currency: 'USD',
    }).select('id').single();
    const before = await notifCount();
    await emitEvent(db, { type: 'change_request.approved', entityTable: 'change_requests', entityId: cr.id, projectId, actorId: null, payload: { title: 'Add wall shelving', budget_impact: 25000 } });
    expect(await notifCount()).toBeGreaterThan(before);
    const evs = await db.from('system_events').select('payload').eq('project_id', projectId).eq('event_type', 'change_request.approved');
    expect(scan(evs.data)).not.toContain('25000');
    const notifs = await db.from('notifications').select('title, body').eq('project_id', projectId).eq('type', 'change_request.approved');
    expect(scan(notifs.data)).not.toContain('25000');
  });

  it('A5: when every item is SENT, "Items are ready" fires once and derives DELIVERY_BUILD', async () => {
    await db.from('production_items').update({ status: 'SENT', po_sign_status: 'SIGNED', pf_sign_status: 'SIGNED' }).in('id', itemIds);
    const before = await notifCount();
    const fired = await maybeEmitItemsReady(db, projectId, null);
    expect(fired).toBe(true);
    expect(await eventCount('project.items_ready')).toBe(1);
    expect(await notifCount()).toBeGreaterThan(before);

    const afterFirst = await notifCount();
    await maybeEmitItemsReady(db, projectId, null);
    expect(await eventCount('project.items_ready')).toBe(1);
    expect(await notifCount()).toBe(afterFirst);

    expect((await lifecycleNow()).phase).toBe('DELIVERY_BUILD');
  });

  it('completing delivery reaches COMPLETED', async () => {
    await db.from('delivery_plans').insert({ project_id: projectId, status: 'completed', customer_accepted: true, delivery_method: 'warehouse' });
    expect((await lifecycleNow()).phase).toBe('COMPLETED');
  });

  it('the tlines_pm cockpit + My Day leak no PF / vendor / margin at ANY point of the chain', async () => {
    const cockpit = await loadCockpit(db, projectId, 'tlines_pm');
    expect(cockpit).toBeTruthy();
    expect(cockpit!.canSeeInternal).toBe(false);
    assertNoLeak(cockpit, 'tlines_pm cockpit');
    for (const t of cockpit!.lifecycle.perType) expect(t).not.toHaveProperty('pfSigned');

    const myDay = await buildMyDay(db, PM, 'tlines_pm');
    assertNoLeak(myDay, 'tlines_pm My Day');
    for (const s of myDay.sections) {
      expect(['vendor_needed', 'items_on_hold', 'unpaid_invoices', 'waiting_payment']).not.toContain(s.key);
    }

    const raw = await lifecycleNow();
    const internal = redactLifecycleForRole(raw, 'ops_manager');
    expect(internal.perType.some(t => 'pfSigned' in t)).toBe(true);
  });
});

describe('Phase 10 smoke — guard', () => {
  it(RUN ? 'is running against the live DB (SMOKE=1)' : 'is SKIPPED unless SMOKE=1', () => {
    expect(true).toBe(true);
  });
});
