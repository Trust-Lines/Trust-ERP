
export const LIFECYCLE_PHASES = [
  'LEAD',
  'SALES_DESIGN',
  'CLOSED_DEAL',
  'PM_FINALIZATION',
  'SUPPLY_DEVELOPMENT',
  'APPROVALS',
  'PRODUCTION_LOGISTICS',
  'DELIVERY_BUILD',
  'COMPLETED',
] as const;

export type LifecyclePhase = typeof LIFECYCLE_PHASES[number];

export const PHASE_LABELS: Record<LifecyclePhase, string> = {
  LEAD:                 'Lead',
  SALES_DESIGN:         'Sales Design',
  CLOSED_DEAL:          'Closed Deal',
  PM_FINALIZATION:      'PM Finalization',
  SUPPLY_DEVELOPMENT:   'Supply Development',
  APPROVALS:            'Proposal / PO Approval',
  PRODUCTION_LOGISTICS: 'Production & Logistics',
  DELIVERY_BUILD:       'Delivery & Build',
  COMPLETED:            'Completed',
};

export function phaseRank(phase: LifecyclePhase): number {
  return LIFECYCLE_PHASES.indexOf(phase);
}

export interface LifecycleItem {
  id:        string;
  type:      string;
  status:    string;
  hasVendor: boolean;
  poSignStatus: string;
  pfSignStatus: string;
  targetDate?: string | null;
}

export interface LifecycleInput {
  project: {
    id?:                    string;
    is_draft:               boolean;
    delivered_to_trust_at:  string | null;
    current_stage?:         string | null;
  };
  designJobs?:      { status: string }[];
  handover?:        { status: string } | null;
  siteReadiness?:   { overall_status: string } | null;
  changeRequests?:  { status: string }[];
  items?:           LifecycleItem[];
  pendingApprovals?: { doc_type: string | null }[];
  containers?:      { status: string }[];
  deliveryPlan?:    { status: string; customer_accepted?: boolean } | null;
  now?:             string;
}

export type BlockerCode =
  | 'designer_unassigned'
  | 'handover_missing'
  | 'handover_in_progress'
  | 'types_not_defined'
  | 'open_change_requests'
  | 'site_not_ready'
  | 'vendor_unassigned'
  | 'po_unsigned'
  | 'pf_unsigned'
  | 'waiting_payment'
  | 'approvals_pending'
  | 'items_on_hold'
  | 'type_overdue'
  | 'delivery_plan_missing'
  | 'customer_not_accepted'
  | 'stage_mismatch';

export const INTERNAL_BLOCKER_CODES: ReadonlySet<BlockerCode> = new Set<BlockerCode>([
  'vendor_unassigned',
  'pf_unsigned',
  'waiting_payment',
]);

export interface LifecycleBlocker {
  code:    BlockerCode;
  message: string;
  count?:  number;
  typeIds?: string[];
}

export type TypeSubPhase =
  | 'VENDOR_PENDING'
  | 'PO_PENDING'
  | 'READY_TO_ORDER'
  | 'ORDERED'
  | 'IN_PRODUCTION'
  | 'READY_TO_SHIP'
  | 'SHIPPING'
  | 'SENT'
  | 'ON_HOLD'
  | 'ASSEMBLY';

export const TYPE_SUB_PHASE_LABELS: Record<TypeSubPhase, string> = {
  VENDOR_PENDING: 'Vendor pending',
  PO_PENDING:     'PO approval pending',
  READY_TO_ORDER: 'Ready to order',
  ORDERED:        'Ordered',
  IN_PRODUCTION:  'In production',
  READY_TO_SHIP:  'Ready to ship',
  SHIPPING:       'Shipping',
  SENT:           'Sent',
  ON_HOLD:        'On hold',
  ASSEMBLY:       'Assembly',
};

export interface LifecycleTypeState {
  id:        string;
  type:      string;
  status:    string;
  subPhase:  TypeSubPhase;
  hasVendor: boolean;
  poSigned:  boolean;
  pfSigned?: boolean;
  targetDate: string | null;
  isOverdue: boolean;
  blockers:  LifecycleBlocker[];
}

export interface LifecycleResult {
  phase:    LifecyclePhase;
  perType:  LifecycleTypeState[];
  blockers: LifecycleBlocker[];
}

const ITEM_NOT_STARTED   = 'NOT_ORDERED';
const ITEM_SENT          = 'SENT';
const ITEM_HOLD          = new Set(['HOLD_T', 'HOLD_PM']);
const ITEM_ASSEMBLY      = 'ASSEMBLY';
const ITEM_WAITING_PAY   = 'WAITING_PAYMENT';
const ITEM_IN_PRODUCTION = new Set(['READY_TO_RECEIVE', 'RECEIVED']);
const ITEM_READY         = 'READY';
const ITEM_SHIPPING      = new Set(['SENT_TO_TLINES', 'PARTIAL_SENT']);
const SIGNED             = 'SIGNED';
const READY_TO_SIGN      = 'READY_TO_SIGN';

const CR_OPEN = new Set(['open', 'under_review']);

const DESIGN_JOB_DEAD = new Set(['cancelled']);

const CONTAINER_CLOSED = new Set(['COMPLETED', 'CANCELLED']);

const STAGE_TO_PHASE: Record<string, LifecyclePhase> = {
  closed_deal:     'CLOSED_DEAL',
  finalization:    'PM_FINALIZATION',
  client_approval: 'APPROVALS',
  production:      'PRODUCTION_LOGISTICS',
  delivered:       'COMPLETED',
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function deriveTypeState(item: LifecycleItem, today: string = todayIso()): LifecycleTypeState {
  const { status, hasVendor } = item;
  const poSigned = item.poSignStatus === SIGNED;
  const pfSigned = item.pfSignStatus === SIGNED;

  const onHold = ITEM_HOLD.has(status);
  const done   = status === ITEM_SENT;

  let subPhase: TypeSubPhase;
  if (onHold)                            subPhase = 'ON_HOLD';
  else if (status === ITEM_ASSEMBLY)     subPhase = 'ASSEMBLY';
  else if (status === ITEM_NOT_STARTED)  subPhase = !hasVendor ? 'VENDOR_PENDING'
                                                  : !poSigned  ? 'PO_PENDING'
                                                  : 'READY_TO_ORDER';
  else if (status === 'ORDERED' || status === ITEM_WAITING_PAY) subPhase = 'ORDERED';
  else if (ITEM_IN_PRODUCTION.has(status)) subPhase = 'IN_PRODUCTION';
  else if (status === ITEM_READY)          subPhase = 'READY_TO_SHIP';
  else if (ITEM_SHIPPING.has(status))      subPhase = 'SHIPPING';
  else if (done)                           subPhase = 'SENT';
  else                                     subPhase = 'IN_PRODUCTION';

  const targetDate = item.targetDate ?? null;
  const isOverdue  = !done && !!targetDate && targetDate < today;

  const blockers: LifecycleBlocker[] = [];
  const flag = (code: BlockerCode, message: string) =>
    blockers.push({ code, message, count: 1, typeIds: [item.id] });

  if (onHold) flag('items_on_hold', `${item.type} is on hold`);
  if (!done) {
    if (!hasVendor)            flag('vendor_unassigned', `${item.type} has no vendor`);
    if (!poSigned)             flag('po_unsigned',       `${item.type} has no signed PO`);
    if (hasVendor && !pfSigned) flag('pf_unsigned',      `${item.type} has no signed PF`);
    if (status === ITEM_WAITING_PAY) flag('waiting_payment', `${item.type} is waiting for payment`);
    if (isOverdue)             flag('type_overdue',      `${item.type} is past its target date`);
  }

  return { id: item.id, type: item.type, status, subPhase, hasVendor, poSigned, pfSigned, targetDate, isOverdue, blockers };
}

export function deriveLifecycle(input: LifecycleInput): LifecycleResult {
  const {
    project,
    designJobs = [],
    handover = null,
    siteReadiness = null,
    changeRequests = [],
    items = [],
    pendingApprovals = [],
    containers = [],
    deliveryPlan = null,
  } = input;

  const today = input.now ?? todayIso();
  const perType: LifecycleTypeState[] = items.map(it => deriveTypeState(it, today));

  const liveDesignJobs = designJobs.filter(j => !DESIGN_JOB_DEAD.has(j.status));

  const hasLeftSales      = !project.is_draft || !!project.delivered_to_trust_at;
  const handoverComplete  = handover?.status === 'complete';
  const typesDefined      = items.length > 0;

  const openCRs      = changeRequests.filter(cr => CR_OPEN.has(cr.status));
  const siteReady    = siteReadiness?.overall_status === 'ready';
  const heldItems    = items.filter(it => ITEM_HOLD.has(it.status));
  const itemsStarted = items.filter(it => it.status !== ITEM_NOT_STARTED && !ITEM_HOLD.has(it.status));
  const itemsSent    = items.filter(it => it.status === ITEM_SENT);
  const allItemsSent = typesDefined && itemsSent.length === items.length;
  const openContainers = containers.filter(c => !CONTAINER_CLOSED.has(c.status));

  const approvalsInFlight =
    pendingApprovals.length > 0 ||
    items.some(it => it.poSignStatus === READY_TO_SIGN || it.pfSignStatus === READY_TO_SIGN);

  const deliveryDone =
    deliveryPlan?.status === 'completed' || project.current_stage === 'delivered';

  const entered: [LifecyclePhase, boolean][] = [
    ['SALES_DESIGN',         liveDesignJobs.length > 0],
    ['CLOSED_DEAL',          hasLeftSales],
    ['PM_FINALIZATION',      hasLeftSales && handoverComplete],
    ['SUPPLY_DEVELOPMENT',   hasLeftSales && handoverComplete && typesDefined],
    ['APPROVALS',            typesDefined && approvalsInFlight],
    ['PRODUCTION_LOGISTICS', itemsStarted.length > 0 || openContainers.length > 0],
    ['DELIVERY_BUILD',       allItemsSent || !!deliveryPlan],
    ['COMPLETED',            deliveryDone],
  ];

  const phase: LifecyclePhase = entered.reduce<LifecyclePhase>(
    (furthest, [candidate, reached]) =>
      reached && phaseRank(candidate) > phaseRank(furthest) ? candidate : furthest,
    'LEAD',
  );

  const blockers: LifecycleBlocker[] = [];
  const rank = phaseRank(phase);

  if (phase === 'SALES_DESIGN' && liveDesignJobs.every(j => j.status === 'awaiting_assignment')) {
    blockers.push({ code: 'designer_unassigned', message: 'Designer not assigned yet' });
  }

  if (hasLeftSales && !handoverComplete) {
    blockers.push(
      handover
        ? { code: 'handover_in_progress', message: 'Handover checklist not complete' }
        : { code: 'handover_missing',     message: 'No handover record yet' },
    );
  }

  if (hasLeftSales && handoverComplete && !typesDefined) {
    blockers.push({ code: 'types_not_defined', message: 'No project types defined yet' });
  }

  if (openCRs.length > 0) {
    blockers.push({
      code: 'open_change_requests',
      message: `${openCRs.length} open change request${openCRs.length === 1 ? '' : 's'}`,
      count: openCRs.length,
    });
  }

  if (rank >= phaseRank('PM_FINALIZATION') && !deliveryDone && !siteReady) {
    blockers.push({
      code: 'site_not_ready',
      message: siteReadiness
        ? `Site ${siteReadiness.overall_status === 'partial' ? 'partially ready' : 'not ready'}`
        : 'Site readiness not started',
    });
  }

  const rollUp = (code: BlockerCode, plural: (n: number) => string) => {
    const hits = perType.filter(t => t.blockers.some(b => b.code === code));
    if (hits.length === 0) return;
    blockers.push({
      code,
      message: plural(hits.length),
      count: hits.length,
      typeIds: hits.map(t => t.id),
    });
  };

  const n = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;

  if (rank >= phaseRank('SUPPLY_DEVELOPMENT') && !deliveryDone) {
    rollUp('vendor_unassigned', c => `${n(c, 'type', 'types')} without a vendor`);
    rollUp('po_unsigned',       c => `${n(c, 'type', 'types')} without a signed PO`);
    rollUp('pf_unsigned',       c => `${n(c, 'type', 'types')} without a signed PF`);
    rollUp('waiting_payment',   c => `${n(c, 'type', 'types')} waiting for payment`);
    rollUp('type_overdue',      c => `${n(c, 'type', 'types')} past the target date`);
  }

  if (pendingApprovals.length > 0) {
    blockers.push({
      code: 'approvals_pending',
      message: `${n(pendingApprovals.length, 'approval', 'approvals')} awaiting signature`,
      count: pendingApprovals.length,
    });
  }

  if (heldItems.length > 0) {
    blockers.push({
      code: 'items_on_hold',
      message: `${n(heldItems.length, 'item', 'items')} on hold`,
      count: heldItems.length,
      typeIds: perType.filter(t => t.subPhase === 'ON_HOLD').map(t => t.id),
    });
  }

  if (allItemsSent && !deliveryPlan) {
    blockers.push({ code: 'delivery_plan_missing', message: 'All items sent — no delivery plan yet' });
  }

  if (deliveryPlan && deliveryPlan.status !== 'completed' && deliveryPlan.customer_accepted === false) {
    blockers.push({ code: 'customer_not_accepted', message: 'Customer has not accepted delivery' });
  }

  const claimed = project.current_stage ? STAGE_TO_PHASE[project.current_stage] : undefined;
  if (hasLeftSales && claimed && phaseRank(claimed) > rank) {
    blockers.push({
      code: 'stage_mismatch',
      message: `Stage says "${PHASE_LABELS[claimed]}" but the project is at "${PHASE_LABELS[phase]}"`,
    });
  }

  return { phase, perType, blockers };
}

const EXTERNAL_TO_SUPPLY_ROLES: ReadonlySet<string> = new Set([
  'tlines_pm',
  'sales_rep',
  'sales_marketing_manager',
  'designer',
]);

export function canSeeInternalSupply(role: string | null | undefined): boolean {
  if (!role) return false;
  return !EXTERNAL_TO_SUPPLY_ROLES.has(role);
}

export function redactLifecycleForRole(result: LifecycleResult, role: string | null | undefined): LifecycleResult {
  if (canSeeInternalSupply(role)) return result;

  const publicOnly = (bs: LifecycleBlocker[]) => bs.filter(b => !INTERNAL_BLOCKER_CODES.has(b.code));

  return {
    phase:    result.phase,
    blockers: publicOnly(result.blockers),
    perType:  result.perType.map(t => {
      const { pfSigned: _pfSigned, ...rest } = t;
      return { ...rest, blockers: publicOnly(t.blockers) };
    }),
  };
}
