import { describe, it, expect } from 'vitest';
import {
  deriveLifecycle,
  deriveTypeState,
  redactLifecycleForRole,
  canSeeInternalSupply,
  phaseRank,
  LIFECYCLE_PHASES,
  type LifecycleInput,
  type LifecycleItem,
} from '@/lib/lifecycle/projectLifecycle';

const base = (over: Partial<LifecycleInput> = {}): LifecycleInput => ({
  project: { is_draft: true, delivered_to_trust_at: null, current_stage: 'closed_deal' },
  ...over,
});

const item = (over: Partial<LifecycleItem> = {}): LifecycleItem => ({
  id: crypto.randomUUID(),
  type: 'Millwork',
  status: 'NOT_ORDERED',
  hasVendor: false,
  poSignStatus: 'NOT_SIGNED',
  pfSignStatus: 'NOT_SIGNED',
  ...over,
});

const codes = (i: LifecycleInput) => deriveLifecycle(i).blockers.map(b => b.code);

describe('lifecycle chain', () => {
  it('is the 8-stage master-plan §3 chain plus COMPLETED, in order', () => {
    expect([...LIFECYCLE_PHASES]).toEqual([
      'LEAD', 'SALES_DESIGN', 'CLOSED_DEAL', 'PM_FINALIZATION', 'SUPPLY_DEVELOPMENT',
      'APPROVALS', 'PRODUCTION_LOGISTICS', 'DELIVERY_BUILD', 'COMPLETED',
    ]);
    expect(phaseRank('LEAD')).toBe(0);
    expect(phaseRank('COMPLETED')).toBe(LIFECYCLE_PHASES.length - 1);
  });
});

describe('deriveLifecycle — phase', () => {
  it('a draft with no design job is a LEAD', () => {
    expect(deriveLifecycle(base()).phase).toBe('LEAD');
  });

  it('a draft with a design job is in SALES_DESIGN', () => {
    const r = deriveLifecycle(base({ designJobs: [{ status: 'working_on_it' }] }));
    expect(r.phase).toBe('SALES_DESIGN');
  });

  it('an unassigned design job still counts as SALES_DESIGN, with a blocker', () => {
    const input = base({ designJobs: [{ status: 'awaiting_assignment' }] });
    expect(deriveLifecycle(input).phase).toBe('SALES_DESIGN');
    expect(codes(input)).toContain('designer_unassigned');
  });

  it('a cancelled design job is not evidence of design work', () => {
    expect(deriveLifecycle(base({ designJobs: [{ status: 'cancelled' }] })).phase).toBe('LEAD');
  });

  it('leaving sales via delivered_to_trust_at reaches CLOSED_DEAL', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: true, delivered_to_trust_at: '2026-07-01T09:00:00Z', current_stage: 'closed_deal' },
    }));
    expect(r.phase).toBe('CLOSED_DEAL');
  });

  it('leaving sales via is_draft=false alone also reaches CLOSED_DEAL', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'closed_deal' },
    }));
    expect(r.phase).toBe('CLOSED_DEAL');
  });

  it('stays in CLOSED_DEAL while the handover is not complete', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'closed_deal' },
      handover: { status: 'in_progress' },
    }));
    expect(r.phase).toBe('CLOSED_DEAL');
  });

  it('a complete handover with no types is PM_FINALIZATION', () => {
    const input = base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
      handover: { status: 'complete' },
    });
    expect(deriveLifecycle(input).phase).toBe('PM_FINALIZATION');
    expect(codes(input)).toContain('types_not_defined');
  });

  it('a complete handover plus defined types is SUPPLY_DEVELOPMENT', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
      handover: { status: 'complete' },
      items: [item(), item({ type: 'Ceiling' })],
    }));
    expect(r.phase).toBe('SUPPLY_DEVELOPMENT');
  });

  it('a pending document approval moves it to APPROVALS', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
      handover: { status: 'complete' },
      items: [item({ hasVendor: true })],
      pendingApprovals: [{ doc_type: 'po_bo' }],
    }));
    expect(r.phase).toBe('APPROVALS');
  });

  it('a PO queued for signature (READY_TO_SIGN) also counts as APPROVALS', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
      handover: { status: 'complete' },
      items: [item({ hasVendor: true, poSignStatus: 'READY_TO_SIGN' })],
    }));
    expect(r.phase).toBe('APPROVALS');
  });

  it('an ordered item moves it to PRODUCTION_LOGISTICS', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: { status: 'complete' },
      items: [item({ status: 'ORDERED', hasVendor: true, poSignStatus: 'SIGNED' })],
    }));
    expect(r.phase).toBe('PRODUCTION_LOGISTICS');
  });

  it('an open container alone is enough for PRODUCTION_LOGISTICS', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: { status: 'complete' },
      items: [item({ hasVendor: true })],
      containers: [{ status: 'IN_TRANSIT' }],
    }));
    expect(r.phase).toBe('PRODUCTION_LOGISTICS');
  });

  it('production evidence overrides a still-pending approval (skips backwards never)', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: { status: 'complete' },
      items: [item({ status: 'RECEIVED', hasVendor: true, poSignStatus: 'SIGNED' })],
      pendingApprovals: [{ doc_type: 'pf' }],
    }));
    expect(r.phase).toBe('PRODUCTION_LOGISTICS');
    expect(r.blockers.map(b => b.code)).toContain('approvals_pending');
  });

  it('all items SENT is DELIVERY_BUILD, and asks for a delivery plan', () => {
    const input = base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: { status: 'complete' },
      items: [item({ status: 'SENT', hasVendor: true, poSignStatus: 'SIGNED' }),
              item({ status: 'SENT', hasVendor: true, poSignStatus: 'SIGNED', type: 'Ceiling' })],
    });
    expect(deriveLifecycle(input).phase).toBe('DELIVERY_BUILD');
    expect(codes(input)).toContain('delivery_plan_missing');
  });

  it('a partially sent project is still PRODUCTION_LOGISTICS', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: { status: 'complete' },
      items: [item({ status: 'SENT', hasVendor: true }), item({ status: 'READY', hasVendor: true })],
    }));
    expect(r.phase).toBe('PRODUCTION_LOGISTICS');
  });

  it('a completed delivery plan is COMPLETED', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: { status: 'complete' },
      items: [item({ status: 'SENT', hasVendor: true, poSignStatus: 'SIGNED' })],
      deliveryPlan: { status: 'completed', customer_accepted: true },
    }));
    expect(r.phase).toBe('COMPLETED');
  });

  it('current_stage=delivered is COMPLETED even without a delivery plan row', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'delivered' },
      handover: { status: 'complete' },
      items: [item({ status: 'SENT', hasVendor: true, poSignStatus: 'SIGNED' })],
    }));
    expect(r.phase).toBe('COMPLETED');
  });
});

describe('deriveLifecycle — blockers', () => {
  const supply = (over: Partial<LifecycleInput> = {}) => base({
    project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
    handover: { status: 'complete' },
    items: [item({ hasVendor: true, poSignStatus: 'SIGNED' })],
    siteReadiness: { overall_status: 'ready' },
    ...over,
  });

  it('counts open change requests and ignores resolved ones', () => {
    const bs = deriveLifecycle(supply({
      changeRequests: [
        { status: 'open' }, { status: 'under_review' },
        { status: 'approved' }, { status: 'rejected' }, { status: 'implemented' }, { status: 'cancelled' },
      ],
    })).blockers;
    const cr = bs.find(b => b.code === 'open_change_requests');
    expect(cr?.count).toBe(2);
    expect(cr?.message).toBe('2 open change requests');
  });

  it('singularises a one-row blocker message', () => {
    const bs = deriveLifecycle(supply({ changeRequests: [{ status: 'open' }] })).blockers;
    expect(bs.find(b => b.code === 'open_change_requests')?.message).toBe('1 open change request');
  });

  it('reports a missing site-readiness row distinctly from a partial one', () => {
    expect(deriveLifecycle(supply({ siteReadiness: null })).blockers
      .find(b => b.code === 'site_not_ready')?.message).toBe('Site readiness not started');
    expect(deriveLifecycle(supply({ siteReadiness: { overall_status: 'partial' } })).blockers
      .find(b => b.code === 'site_not_ready')?.message).toBe('Site partially ready');
    expect(deriveLifecycle(supply({ siteReadiness: { overall_status: 'ready' } })).blockers
      .map(b => b.code)).not.toContain('site_not_ready');
  });

  it('site readiness never pins the phase — it only blocks', () => {
    const r = deriveLifecycle(supply({
      siteReadiness: null,
      items: [item({ status: 'ORDERED', hasVendor: true, poSignStatus: 'SIGNED' })],
    }));
    expect(r.phase).toBe('PRODUCTION_LOGISTICS');
    expect(r.blockers.map(b => b.code)).toContain('site_not_ready');
  });

  it('flags types with no vendor and types with no signed PO', () => {
    const bs = deriveLifecycle(supply({
      items: [
        item({ hasVendor: false, poSignStatus: 'NOT_SIGNED' }),
        item({ hasVendor: true,  poSignStatus: 'SIGNED', type: 'Ceiling' }),
      ],
    })).blockers;
    expect(bs.find(b => b.code === 'vendor_unassigned')?.count).toBe(1);
    expect(bs.find(b => b.code === 'po_unsigned')?.count).toBe(1);
  });

  it('does not nag about vendors or POs before types exist', () => {
    const bs = codes(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'closed_deal' },
      handover: { status: 'complete' },
    }));
    expect(bs).not.toContain('vendor_unassigned');
    expect(bs).not.toContain('po_unsigned');
  });

  it('stops nagging about vendors, POs and the site once the project is COMPLETED', () => {
    const bs = codes(supply({
      siteReadiness: null,
      items: [item({ status: 'SENT', hasVendor: false, poSignStatus: 'NOT_SIGNED' })],
      deliveryPlan: { status: 'completed', customer_accepted: true },
    }));
    expect(bs).not.toContain('site_not_ready');
    expect(bs).not.toContain('vendor_unassigned');
    expect(bs).not.toContain('po_unsigned');
  });

  it('counts held items', () => {
    const bs = deriveLifecycle(supply({
      items: [item({ status: 'HOLD_T', hasVendor: true }), item({ status: 'HOLD_PM', hasVendor: true })],
    })).blockers;
    expect(bs.find(b => b.code === 'items_on_hold')?.count).toBe(2);
  });

  it('a held item is not "started" — HOLD alone does not reach PRODUCTION_LOGISTICS', () => {
    const r = deriveLifecycle(supply({ items: [item({ status: 'HOLD_PM', hasVendor: true, poSignStatus: 'SIGNED' })] }));
    expect(r.phase).toBe('SUPPLY_DEVELOPMENT');
    expect(r.blockers.map(b => b.code)).toContain('items_on_hold');
  });

  it('flags a delivery the customer has not accepted', () => {
    const bs = codes(supply({
      items: [item({ status: 'SENT', hasVendor: true, poSignStatus: 'SIGNED' })],
      deliveryPlan: { status: 'in_progress', customer_accepted: false },
    }));
    expect(bs).toContain('customer_not_accepted');
    expect(bs).not.toContain('delivery_plan_missing');
  });
});

describe('deriveLifecycle — stage mismatch', () => {
  it('shows the furthest-BEHIND phase and reports the mismatch', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: null,
    }));
    expect(r.phase).toBe('CLOSED_DEAL');
    const m = r.blockers.find(b => b.code === 'stage_mismatch');
    expect(m?.message).toBe('Stage says "Production & Logistics" but the project is at "Closed Deal"');
  });

  it('is silent when the stage column agrees with, or lags, the evidence', () => {
    const agree = codes(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'closed_deal' },
    }));
    expect(agree).not.toContain('stage_mismatch');

    const lags = codes(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'closed_deal' },
      handover: { status: 'complete' },
      items: [item({ status: 'ORDERED', hasVendor: true, poSignStatus: 'SIGNED' })],
      siteReadiness: { overall_status: 'ready' },
    }));
    expect(lags).not.toContain('stage_mismatch');
  });
});

describe('deriveLifecycle — real live-DB projects', () => {
  it('STW 1..6, 151, 190-192: draft, closed_deal stage, no handover → LEAD/SALES_DESIGN', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: true, delivered_to_trust_at: null, current_stage: 'closed_deal' },
      items: [item()],
    }));
    expect(r.phase).toBe('LEAD');
    expect(r.blockers.map(b => b.code)).not.toContain('stage_mismatch');
  });

  it('project 193: delivered to Trust, finalization stage, NO handover row → CLOSED_DEAL', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: '2026-07-02T10:00:00Z', current_stage: 'finalization' },
      handover: null,
      items: [item(), item({ type: 'Ceiling' }), item({ type: 'Shelving' })],
    }));
    expect(r.phase).toBe('CLOSED_DEAL');
    expect(r.blockers.map(b => b.code)).toEqual(
      expect.arrayContaining(['handover_missing', 'stage_mismatch']),
    );
  });

  it('project STNE 485: finalization stage but handover only in_progress → CLOSED_DEAL', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
      handover: { status: 'in_progress' },
      items: Array.from({ length: 8 }, () => item()),
    }));
    expect(r.phase).toBe('CLOSED_DEAL');
    expect(r.blockers.map(b => b.code)).toEqual(
      expect.arrayContaining(['handover_in_progress', 'stage_mismatch']),
    );
  });

  it('project 343: client_approval stage, no handover, 3 untouched types → CLOSED_DEAL', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'client_approval' },
      handover: null,
      items: [item(), item({ type: 'Ceiling' }), item({ type: 'Shelving' })],
    }));
    expect(r.phase).toBe('CLOSED_DEAL');
    const m = r.blockers.find(b => b.code === 'stage_mismatch');
    expect(m?.message).toBe('Stage says "Proposal / PO Approval" but the project is at "Closed Deal"');
  });
});

describe('deriveLifecycle — perType', () => {
  it('projects each type with its sub-state, preserving order', () => {
    const { perType } = deriveLifecycle(base({
      now: '2026-07-14',
      items: [
        item({ id: 'a', type: 'Millwork', status: 'ORDERED', hasVendor: true,  poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED', targetDate: '2026-09-01' }),
        item({ id: 'b', type: 'Ceiling',  status: 'NOT_ORDERED' }),
      ],
    }));
    expect(perType.map(t => t.id)).toEqual(['a', 'b']);
    expect(perType[0]).toMatchObject({
      id: 'a', type: 'Millwork', status: 'ORDERED', subPhase: 'ORDERED',
      hasVendor: true, poSigned: true, pfSigned: true, targetDate: '2026-09-01',
      isOverdue: false, blockers: [],
    });
    expect(perType[1]).toMatchObject({
      id: 'b', type: 'Ceiling', status: 'NOT_ORDERED', subPhase: 'VENDOR_PENDING',
      hasVendor: false, poSigned: false, pfSigned: false, targetDate: null, isOverdue: false,
    });
  });

  it('is empty when no types are defined', () => {
    expect(deriveLifecycle(base()).perType).toEqual([]);
  });
});

describe('deriveTypeState — sub-phase', () => {
  const sub = (over: Partial<LifecycleItem>) => deriveTypeState(item(over), '2026-07-14').subPhase;

  it('walks the NOT_ORDERED gate: vendor → PO → ready to order', () => {
    expect(sub({ status: 'NOT_ORDERED', hasVendor: false })).toBe('VENDOR_PENDING');
    expect(sub({ status: 'NOT_ORDERED', hasVendor: true, poSignStatus: 'NOT_SIGNED' })).toBe('PO_PENDING');
    expect(sub({ status: 'NOT_ORDERED', hasVendor: true, poSignStatus: 'READY_TO_SIGN' })).toBe('PO_PENDING');
    expect(sub({ status: 'NOT_ORDERED', hasVendor: true, poSignStatus: 'SIGNED' })).toBe('READY_TO_ORDER');
  });

  it('maps the production chain onto sub-phases', () => {
    const on = { hasVendor: true, poSignStatus: 'SIGNED' };
    expect(sub({ ...on, status: 'ORDERED' })).toBe('ORDERED');
    expect(sub({ ...on, status: 'WAITING_PAYMENT' })).toBe('ORDERED');
    expect(sub({ ...on, status: 'READY_TO_RECEIVE' })).toBe('IN_PRODUCTION');
    expect(sub({ ...on, status: 'RECEIVED' })).toBe('IN_PRODUCTION');
    expect(sub({ ...on, status: 'READY' })).toBe('READY_TO_SHIP');
    expect(sub({ ...on, status: 'SENT_TO_TLINES' })).toBe('SHIPPING');
    expect(sub({ ...on, status: 'PARTIAL_SENT' })).toBe('SHIPPING');
    expect(sub({ ...on, status: 'SENT' })).toBe('SENT');
  });

  it('keeps the OFF-CHAIN statuses off the chain', () => {
    expect(sub({ status: 'HOLD_T', hasVendor: true })).toBe('ON_HOLD');
    expect(sub({ status: 'HOLD_PM', hasVendor: true })).toBe('ON_HOLD');
    expect(sub({ status: 'ASSEMBLY', hasVendor: true })).toBe('ASSEMBLY');
  });

  it('a HOLD outranks the vendor/PO gate — it reports ON_HOLD, not VENDOR_PENDING', () => {
    expect(sub({ status: 'HOLD_PM', hasVendor: false })).toBe('ON_HOLD');
  });

  it('never calls an unknown status "done"', () => {
    expect(sub({ status: 'SOME_NEW_STATUS', hasVendor: true })).toBe('IN_PRODUCTION');
  });
});

describe('deriveTypeState — blockers', () => {
  const codesOf = (over: Partial<LifecycleItem>, today = '2026-07-14') =>
    deriveTypeState(item(over), today).blockers.map(b => b.code);

  it('flags a type with no vendor, no PO', () => {
    expect(codesOf({ hasVendor: false })).toEqual(
      expect.arrayContaining(['vendor_unassigned', 'po_unsigned']),
    );
  });

  it('only asks for a PF once a vendor exists (no vendor → no PF to sign yet)', () => {
    expect(codesOf({ hasVendor: false })).not.toContain('pf_unsigned');
    expect(codesOf({ hasVendor: true })).toContain('pf_unsigned');
    expect(codesOf({ hasVendor: true, pfSignStatus: 'SIGNED' })).not.toContain('pf_unsigned');
  });

  it('flags a type waiting for payment', () => {
    expect(codesOf({ status: 'WAITING_PAYMENT', hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED' }))
      .toEqual(['waiting_payment']);
  });

  it('flags a type past its target date, and is inclusive of today', () => {
    const live = { hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED', status: 'ORDERED' };
    expect(codesOf({ ...live, targetDate: '2026-07-13' })).toContain('type_overdue');
    expect(codesOf({ ...live, targetDate: '2026-07-14' })).not.toContain('type_overdue');
    expect(codesOf({ ...live, targetDate: '2026-07-15' })).not.toContain('type_overdue');
    expect(codesOf({ ...live, targetDate: null })).not.toContain('type_overdue');
  });

  it('a SENT type is finished — it stops nagging about everything', () => {
    const done = deriveTypeState(
      item({ status: 'SENT', hasVendor: false, poSignStatus: 'NOT_SIGNED', pfSignStatus: 'NOT_SIGNED', targetDate: '2020-01-01' }),
      '2026-07-14',
    );
    expect(done.blockers).toEqual([]);
    expect(done.isOverdue).toBe(false);
    expect(done.subPhase).toBe('SENT');
  });

  it('a held type reports the hold alongside its outstanding work', () => {
    const codes = codesOf({ status: 'HOLD_T', hasVendor: false });
    expect(codes).toContain('items_on_hold');
    expect(codes).toContain('vendor_unassigned');
  });

  it('scopes each blocker to its own type id', () => {
    const t = deriveTypeState(item({ id: 'zz', type: 'Ceiling', hasVendor: false }), '2026-07-14');
    for (const b of t.blockers) {
      expect(b.typeIds).toEqual(['zz']);
      expect(b.count).toBe(1);
      expect(b.message).toContain('Ceiling');
    }
  });
});

describe('deriveLifecycle — type blockers roll up to the project', () => {
  const supplyProject = (items: LifecycleItem[], over: Partial<LifecycleInput> = {}) => deriveLifecycle(base({
    project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'finalization' },
    handover: { status: 'complete' },
    siteReadiness: { overall_status: 'ready' },
    now: '2026-07-14',
    items,
    ...over,
  }));

  it('rolls each type-level code up with a count and the driving type ids', () => {
    const r = supplyProject([
      item({ id: 'a', hasVendor: false }),
      item({ id: 'b', type: 'Ceiling', hasVendor: false }),
      item({ id: 'c', type: 'Image', hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED' }),
    ]);
    const vendor = r.blockers.find(b => b.code === 'vendor_unassigned');
    expect(vendor?.count).toBe(2);
    expect(vendor?.message).toBe('2 types without a vendor');
    expect(vendor?.typeIds).toEqual(['a', 'b']);

    expect(r.blockers.find(b => b.code === 'po_unsigned')?.typeIds).toEqual(['a', 'b']);
  });

  it('rolls up overdue types', () => {
    const r = supplyProject([
      item({ id: 'a', status: 'ORDERED', hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED', targetDate: '2026-01-01' }),
      item({ id: 'b', status: 'ORDERED', hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED', targetDate: '2027-01-01' }),
    ]);
    const od = r.blockers.find(b => b.code === 'type_overdue');
    expect(od?.count).toBe(1);
    expect(od?.message).toBe('1 type past the target date');
    expect(od?.typeIds).toEqual(['a']);
  });

  it('the project rail and the type cells never disagree', () => {
    const r = supplyProject([item({ id: 'a', hasVendor: false }), item({ id: 'b', hasVendor: false })]);
    for (const b of r.blockers.filter(x => x.typeIds)) {
      for (const id of b.typeIds!) {
        const t = r.perType.find(x => x.id === id)!;
        expect(t.blockers.map(x => x.code)).toContain(b.code);
      }
    }
  });

  it('does not nag about supply before the project is in supply', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'closed_deal' },
      handover: { status: 'in_progress' },
      items: [item({ hasVendor: false })],
    }));
    expect(r.phase).toBe('CLOSED_DEAL');
    const cs = r.blockers.map(b => b.code);
    expect(cs).not.toContain('vendor_unassigned');
    expect(cs).not.toContain('pf_unsigned');
    expect(r.perType[0].blockers.map(b => b.code)).toContain('vendor_unassigned');
  });
});

describe('redactLifecycleForRole', () => {
  const internalLeaky = () => deriveLifecycle(base({
    project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
    handover: { status: 'complete' },
    siteReadiness: { overall_status: 'ready' },
    now: '2026-07-14',
    items: [
      item({ id: 'a', hasVendor: false }),
      item({ id: 'b', type: 'Ceiling', status: 'WAITING_PAYMENT', hasVendor: true, poSignStatus: 'SIGNED' }),
    ],
    pendingApprovals: [{ doc_type: 'po_bo' }],
    changeRequests: [{ status: 'open' }],
  }));

  it('decides internal visibility per role, failing closed on an unresolved role', () => {
    expect(canSeeInternalSupply('ops_manager')).toBe(true);
    expect(canSeeInternalSupply('general_manager')).toBe(true);
    expect(canSeeInternalSupply('production_manager')).toBe(true);
    expect(canSeeInternalSupply('trustlines_pm')).toBe(true);
    expect(canSeeInternalSupply('tlines_pm')).toBe(false);
    expect(canSeeInternalSupply('designer')).toBe(false);
    expect(canSeeInternalSupply('sales_rep')).toBe(false);
    expect(canSeeInternalSupply(null)).toBe(false);
    expect(canSeeInternalSupply(undefined)).toBe(false);
    expect(canSeeInternalSupply('')).toBe(false);
  });

  it('leaves an internal role’s view untouched', () => {
    const full = internalLeaky();
    expect(redactLifecycleForRole(full, 'ops_manager')).toBe(full);
    expect(full.blockers.map(b => b.code)).toEqual(
      expect.arrayContaining(['vendor_unassigned', 'pf_unsigned', 'waiting_payment']),
    );
    expect(full.perType[0].pfSigned).toBe(false);
  });

  it('strips vendor, PF and payment facts for tlines_pm — from the rail AND every type cell', () => {
    const safe = redactLifecycleForRole(internalLeaky(), 'tlines_pm');

    for (const code of ['vendor_unassigned', 'pf_unsigned', 'waiting_payment']) {
      expect(safe.blockers.map(b => b.code)).not.toContain(code);
      for (const t of safe.perType) expect(t.blockers.map(b => b.code)).not.toContain(code);
    }
    for (const t of safe.perType) {
      expect(t).not.toHaveProperty('pfSigned');
      expect(Object.keys(t)).not.toContain('pfSigned');
    }
    expect(JSON.stringify(safe).toLowerCase()).not.toContain('pf');
  });

  it('still shows tlines_pm what §4.6 says they MAY see', () => {
    const safe = redactLifecycleForRole(internalLeaky(), 'tlines_pm');
    const cs = safe.blockers.map(b => b.code);
    expect(cs).toContain('po_unsigned');
    expect(cs).toContain('approvals_pending');
    expect(cs).toContain('open_change_requests');
    expect(safe.phase).toBe('PRODUCTION_LOGISTICS');
    expect(safe.perType.map(t => t.subPhase)).toEqual(['VENDOR_PENDING', 'ORDERED']);
  });

  it('the redacted view still carries no price, cost or margin anywhere', () => {
    const serialised = JSON.stringify(redactLifecycleForRole(internalLeaky(), 'tlines_pm')).toLowerCase();
    for (const forbidden of ['pf_usd', 'pf_tl', 'invoice', 'expenses', 'margin', 'cost', 'price', 'vendor_id', 'amount']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('the string "pf" appears NOWHERE in a tlines_pm payload — in ANY phase', () => {
    for (const stage of ['closed_deal', 'finalization', 'client_approval', 'production', 'delivered']) {
      for (const items of [[], [item({ hasVendor: true, pfSignStatus: 'READY_TO_SIGN' })]]) {
        const full = deriveLifecycle(base({
          project: { is_draft: false, delivered_to_trust_at: null, current_stage: stage },
          handover: { status: 'complete' },
          items,
          pendingApprovals: [{ doc_type: 'pf' }],
          now: '2026-07-14',
        }));
        const safe = JSON.stringify(redactLifecycleForRole(full, 'tlines_pm')).toLowerCase();
        expect(safe, `stage=${stage} items=${items.length}`).not.toContain('pf');
      }
    }
  });
});

describe('deriveLifecycle — no sensitive field can escape', () => {
  it('carries no price, PF, cost, margin or vendor-identity field in its output', () => {
    const r = deriveLifecycle(base({
      project: { is_draft: false, delivered_to_trust_at: null, current_stage: 'production' },
      handover: { status: 'complete' },
      items: [item({ status: 'ORDERED', hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED' })],
      pendingApprovals: [{ doc_type: 'pf' }],
      changeRequests: [{ status: 'open' }],
    }));

    const serialised = JSON.stringify(r).toLowerCase();
    for (const forbidden of [
      'pf_usd', 'pf_tl', 'invoice', 'expenses', 'margin', 'cost', 'price',
      'vendor_id', 'budget_impact', 'deal_value', 'amount',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('exposes vendor presence as a boolean, never the vendor itself', () => {
    const { perType } = deriveLifecycle(base({ items: [item({ hasVendor: true })] }));
    expect(perType[0].hasVendor).toBe(true);
    expect(Object.keys(perType[0])).not.toContain('vendor_id');
    expect(Object.keys(perType[0])).not.toContain('vendorId');
  });
});
