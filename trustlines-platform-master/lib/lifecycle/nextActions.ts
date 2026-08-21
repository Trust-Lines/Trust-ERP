
import type { LifecycleResult, LifecycleBlocker, BlockerCode } from './projectLifecycle';

export type ActionOwner =
  | { kind: 'role'; role: string }
  | { kind: 'project_pm'; slot: 'tlines_pm_id' | 'trustlines_pm_id' };

export interface NextAction {
  code:    BlockerCode;
  action:  string;
  owner:   ActionOwner;
  href:    string;
  priority: number;
  typeIds?: string[];
}

const role = (r: string): ActionOwner => ({ kind: 'role', role: r });
const pm = (slot: 'tlines_pm_id' | 'trustlines_pm_id'): ActionOwner => ({ kind: 'project_pm', slot });

type Rule = (b: LifecycleBlocker, projectId: string) => Omit<NextAction, 'code' | 'typeIds'>;

const RULES: Partial<Record<BlockerCode, Rule>> = {
  designer_unassigned: (_b, id) => ({
    action: 'Assign a designer to the sales design job',
    owner: role('sales_marketing_manager'), href: `/projects/${id}`, priority: 40,
  }),
  handover_missing: (_b, id) => ({
    action: 'Start the project handover',
    owner: pm('trustlines_pm_id'), href: `/projects/${id}/handover`, priority: 70,
  }),
  handover_in_progress: (_b, id) => ({
    action: 'Complete the handover checklist',
    owner: pm('trustlines_pm_id'), href: `/projects/${id}/handover`, priority: 65,
  }),
  types_not_defined: (_b, id) => ({
    action: 'Define the project types',
    owner: role('production_manager'), href: `/projects/${id}/types`, priority: 60,
  }),
  open_change_requests: (b, id) => ({
    action: `Resolve ${b.count ?? ''} open change request${b.count === 1 ? '' : 's'}`.replace('  ', ' ').trim(),
    owner: pm('trustlines_pm_id'), href: `/projects/${id}/finalization`, priority: 55,
  }),
  site_not_ready: (_b, id) => ({
    action: 'Get the site to ready',
    owner: pm('tlines_pm_id'), href: `/projects/${id}/finalization`, priority: 30,
  }),
  vendor_unassigned: (b, id) => ({
    action: `Assign a vendor to ${b.count ?? ''} type${b.count === 1 ? '' : 's'}`.replace('  ', ' ').trim(),
    owner: role('production_manager'), href: `/projects/${id}/types`, priority: 80,
  }),
  po_unsigned: (b, id) => ({
    action: `Sign the PO for ${b.count ?? ''} type${b.count === 1 ? '' : 's'}`.replace('  ', ' ').trim(),
    owner: role('general_manager'), href: `/projects/${id}/types`, priority: 75,
  }),
  pf_unsigned: (b, id) => ({
    action: `Sign the PF for ${b.count ?? ''} type${b.count === 1 ? '' : 's'}`.replace('  ', ' ').trim(),
    owner: role('production_manager'), href: `/projects/${id}/types`, priority: 74,
  }),
  approvals_pending: (b) => ({
    action: `${b.count ?? 'Some'} approval${b.count === 1 ? '' : 's'} awaiting signature`,
    owner: role('general_manager'), href: `/approvals`, priority: 72,
  }),
  waiting_payment: (b, id) => ({
    action: `Clear payment for ${b.count ?? ''} type${b.count === 1 ? '' : 's'}`.replace('  ', ' ').trim(),
    owner: role('accountant'), href: `/projects/${id}/finance`, priority: 50,
  }),
  items_on_hold: (b, id) => ({
    action: `Release ${b.count ?? ''} item${b.count === 1 ? '' : 's'} on hold`.replace('  ', ' ').trim(),
    owner: role('production_manager'), href: `/projects/${id}/types`, priority: 45,
  }),
  type_overdue: (b, id) => ({
    action: `${b.count ?? 'Some'} type${b.count === 1 ? '' : 's'} past the target date`,
    owner: role('production_manager'), href: `/projects/${id}/types`, priority: 48,
  }),
  delivery_plan_missing: (_b, id) => ({
    action: 'Create the delivery plan',
    owner: pm('tlines_pm_id'), href: `/projects/${id}/delivery`, priority: 35,
  }),
  customer_not_accepted: (_b, id) => ({
    action: 'Get customer acceptance of the delivery',
    owner: pm('tlines_pm_id'), href: `/projects/${id}/delivery`, priority: 25,
  }),
};

export function nextActions(result: LifecycleResult, projectId: string): NextAction[] {
  const actions: NextAction[] = [];
  for (const b of result.blockers) {
    const rule = RULES[b.code];
    if (!rule) continue;
    const base = rule(b, projectId);
    actions.push({ code: b.code, typeIds: b.typeIds, ...base });
  }
  return actions.sort((a, b) => b.priority - a.priority);
}
