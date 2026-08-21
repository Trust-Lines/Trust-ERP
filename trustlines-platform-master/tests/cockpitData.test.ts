import { describe, it, expect } from 'vitest';
import { nextActions } from '@/lib/lifecycle/nextActions';
import { assembleCockpit, buildRail, type CockpitInput } from '@/lib/lifecycle/cockpitData';
import { deriveLifecycle, type LifecycleItem } from '@/lib/lifecycle/projectLifecycle';

const item = (over: Partial<LifecycleItem> = {}): LifecycleItem => ({
  id: crypto.randomUUID(), type: 'Millwork', status: 'NOT_ORDERED',
  hasVendor: false, poSignStatus: 'NOT_SIGNED', pfSignStatus: 'NOT_SIGNED', ...over,
});

const supplyInput = (over: Partial<CockpitInput['lifecycle']> = {}): CockpitInput => ({
  project: {
    id: 'p1', code: 'STW 460', name: 'Fifth Avenue Store',
    is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization',
    tlines_pm_id: 'tpm', trustlines_pm_id: 'trpm',
  },
  lifecycle: {
    handover: { status: 'complete' },
    siteReadiness: { overall_status: 'ready' },
    items: [item({ hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED' })],
    now: '2026-07-14',
    ...over,
  },
  pending: { openApprovals: 0, openChangeRequests: 0, overdueFollowUps: 0 },
});

describe('nextActions', () => {
  it('turns a vendor-gap blocker into an owned, linked action', () => {
    const r = deriveLifecycle({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
      handover: { status: 'complete' }, siteReadiness: { overall_status: 'ready' },
      items: [item({ hasVendor: false }), item({ hasVendor: false, type: 'Ceiling' })],
      now: '2026-07-14',
    });
    const actions = nextActions(r, 'p1');
    const vendor = actions.find(a => a.code === 'vendor_unassigned');
    expect(vendor).toBeTruthy();
    expect(vendor!.action).toBe('Assign a vendor to 2 types');
    expect(vendor!.owner).toEqual({ kind: 'role', role: 'production_manager' });
    expect(vendor!.href).toBe('/projects/p1/types');
    expect(vendor!.typeIds).toHaveLength(2);
  });

  it('orders by priority — the most downstream blocker first', () => {
    const r = deriveLifecycle({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
      handover: { status: 'complete' }, siteReadiness: { overall_status: 'not_ready' },
      items: [item({ hasVendor: false })],
      now: '2026-07-14',
    });
    const codes = nextActions(r, 'p1').map(a => a.code);
    expect(codes.indexOf('vendor_unassigned')).toBeLessThan(codes.indexOf('site_not_ready'));
  });

  it('produces NO action for stage_mismatch (a data note, not a task)', () => {
    const r = deriveLifecycle({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: null,
    });
    expect(r.blockers.some(b => b.code === 'stage_mismatch')).toBe(true);
    expect(nextActions(r, 'p1').some(a => a.code === 'stage_mismatch')).toBe(false);
  });

  it('assigns handover work to the Trust PM slot', () => {
    const r = deriveLifecycle({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'closed_deal' },
      handover: null,
    });
    const a = nextActions(r, 'p1').find(x => x.code === 'handover_missing');
    expect(a!.owner).toEqual({ kind: 'project_pm', slot: 'trustlines_pm_id' });
    expect(a!.href).toBe('/projects/p1/handover');
  });

  it('is empty for a clean project', () => {
    const r = deriveLifecycle({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: { status: 'complete' }, siteReadiness: { overall_status: 'ready' },
      items: [item({ status: 'SENT', hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED' })],
      deliveryPlan: { status: 'completed', customer_accepted: true },
      now: '2026-07-14',
    });
    expect(nextActions(r, 'p1')).toEqual([]);
  });
});

describe('buildRail', () => {
  it('marks everything before active done, active active, the rest upcoming', () => {
    const rail = buildRail('PM_FINALIZATION');
    const byState = (s: string) => rail.filter(r => r.state === s).map(r => r.phase);
    expect(byState('active')).toEqual(['PM_FINALIZATION']);
    expect(byState('done')).toEqual(['LEAD', 'SALES_DESIGN', 'CLOSED_DEAL']);
    expect(rail[rail.length - 1]).toMatchObject({ phase: 'COMPLETED', state: 'upcoming' });
    expect(rail).toHaveLength(9);
  });

  it('has no done stages when the project is at LEAD', () => {
    expect(buildRail('LEAD').filter(r => r.state === 'done')).toEqual([]);
  });
});

describe('assembleCockpit', () => {
  it('builds rail + actions + pending from one input, for an internal role', () => {
    const c = assembleCockpit(supplyInput({
      items: [item({ hasVendor: false })],
    }), 'p1', 'ops_manager');

    expect(c.projectCode).toBe('STW 460');
    expect(c.lifecycle.phase).toBe('SUPPLY_DEVELOPMENT');
    expect(c.rail.find(r => r.state === 'active')?.phase).toBe('SUPPLY_DEVELOPMENT');
    expect(c.nextActions.some(a => a.code === 'vendor_unassigned')).toBe(true);
    expect(c.canSeeInternal).toBe(true);
  });

  it('carries the pending strip through unchanged', () => {
    const c = assembleCockpit({
      ...supplyInput(),
      pending: { openApprovals: 3, openChangeRequests: 2, overdueFollowUps: 1 },
    }, 'p1', 'ops_manager');
    expect(c.pending).toEqual({ openApprovals: 3, openChangeRequests: 2, overdueFollowUps: 1 });
  });

  it('a tlines_pm cockpit shows NO internal-supply action, blocker or type field', () => {
    const c = assembleCockpit(supplyInput({
      items: [
        item({ hasVendor: false }),
        item({ type: 'Ceiling', status: 'WAITING_PAYMENT', hasVendor: true, poSignStatus: 'SIGNED' }),
      ],
      pendingApprovals: [{ doc_type: 'po_bo' }],
    }), 'p1', 'tlines_pm');

    expect(c.canSeeInternal).toBe(false);

    for (const code of ['vendor_unassigned', 'pf_unsigned', 'waiting_payment']) {
      expect(c.lifecycle.blockers.map(b => b.code)).not.toContain(code);
      expect(c.nextActions.map(a => a.code)).not.toContain(code);
      for (const t of c.lifecycle.perType) expect(t.blockers.map(b => b.code)).not.toContain(code);
    }
    for (const t of c.lifecycle.perType) expect(t).not.toHaveProperty('pfSigned');

    expect(c.nextActions.some(a => a.code === 'po_unsigned' || a.code === 'approvals_pending')).toBe(true);

    const serialised = JSON.stringify(c).toLowerCase();
    for (const forbidden of ['pf_usd', 'pf_tl', 'vendor_id', 'margin', 'cost', 'price', 'invoice']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('the same project shows internal actions to an internal role', () => {
    const c = assembleCockpit(supplyInput({
      items: [item({ hasVendor: false })],
    }), 'p1', 'production_manager');
    expect(c.canSeeInternal).toBe(true);
    expect(c.nextActions.some(a => a.code === 'vendor_unassigned')).toBe(true);
  });

  it('fails closed for an unresolved role — no internal detail', () => {
    const c = assembleCockpit(supplyInput({
      items: [item({ hasVendor: false })],
    }), 'p1', null);
    expect(c.canSeeInternal).toBe(false);
    expect(c.nextActions.map(a => a.code)).not.toContain('vendor_unassigned');
  });
});
