
import {
  deriveLifecycle,
  redactLifecycleForRole,
  canSeeInternalSupply,
  PHASE_LABELS,
  phaseRank,
  LIFECYCLE_PHASES,
  type LifecycleInput,
  type LifecycleResult,
  type LifecyclePhase,
} from './projectLifecycle';
import { nextActions, type NextAction } from './nextActions';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RailStage {
  phase:    LifecyclePhase;
  label:    string;
  state:    'done' | 'active' | 'upcoming';
}

export interface PendingCounts {
  openApprovals:    number;
  openChangeRequests: number;
  overdueFollowUps: number;
}

export interface CockpitData {
  projectId:   string;
  projectCode: string;
  projectName: string;
  lifecycle:   LifecycleResult;
  rail:        RailStage[];
  nextActions: NextAction[];
  pending:     PendingCounts;
  canSeeInternal: boolean;
}

export interface CockpitInput {
  project:     LifecycleInput['project'] & { code: string; name: string; tlines_pm_id?: string | null; trustlines_pm_id?: string | null };
  lifecycle:   Omit<LifecycleInput, 'project'>;
  pending:     PendingCounts;
}

export function buildRail(active: LifecyclePhase): RailStage[] {
  const activeRank = phaseRank(active);
  return LIFECYCLE_PHASES.map(phase => ({
    phase,
    label: PHASE_LABELS[phase],
    state: phaseRank(phase) < activeRank ? 'done' : phaseRank(phase) === activeRank ? 'active' : 'upcoming',
  }));
}

export function assembleCockpit(input: CockpitInput, projectId: string, role: string | null | undefined): CockpitData {
  const raw = deriveLifecycle({ project: input.project, ...input.lifecycle });
  const lifecycle = redactLifecycleForRole(raw, role);
  const canSeeInternal = canSeeInternalSupply(role);

  return {
    projectId,
    projectCode: input.project.code,
    projectName: input.project.name,
    lifecycle,
    rail: buildRail(lifecycle.phase),
    nextActions: nextActions(lifecycle, projectId),
    pending: input.pending,
    canSeeInternal,
  };
}

const PROJECT_COLS =
  'id, code, name, is_draft, delivered_to_trust_at, current_stage, customer_id, tlines_pm_id, trustlines_pm_id';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadCockpit(admin: any, projectId: string, role: string | null | undefined): Promise<CockpitData | null> {
  const { data: project } = await admin.from('projects').select(PROJECT_COLS).eq('id', projectId).maybeSingle();
  if (!project) return null;

  const today = todayIso();

  const { data: lead } = await admin.from('lead_intake').select('id').eq('project_id', projectId).maybeSingle();
  const leadId = (lead as { id: string } | null)?.id ?? null;

  const [
    designJobsRes, handoverRes, siteRes, crRes, itemsRes, apprRes, planRes, followUpRes,
  ] = await Promise.all([
    leadId
      ? admin.from('sales_design_jobs').select('status').eq('lead_intake_id', leadId).is('deleted_at', null).limit(50)
      : Promise.resolve({ data: [] }),
    admin.from('project_handovers').select('status').eq('project_id', projectId).maybeSingle(),
    admin.from('site_readiness').select('overall_status').eq('project_id', projectId).maybeSingle(),
    admin.from('change_requests').select('status').eq('project_id', projectId).is('deleted_at', null).limit(200),
    admin.from('production_items')
      .select('id, type, status, vendor_id, po_sign_status, pf_sign_status, target_date')
      .eq('project_id', projectId).eq('source', 'project').is('deleted_at', null).limit(200),
    admin.from('document_approvals').select('doc_type, status').eq('project_id', projectId).eq('status', 'pending').limit(200),
    admin.from('delivery_plans').select('status, customer_accepted').eq('project_id', projectId).maybeSingle(),
    project.customer_id
      ? admin.from('customer_follow_ups').select('status, due_date').eq('project_id', projectId).is('deleted_at', null).limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = <T,>(r: { data: T[] | null; error?: unknown } | { data: T | null }): T[] =>
    Array.isArray((r as { data: unknown }).data) ? ((r as { data: T[] }).data ?? []) : [];

  const items = rows<{ id: string; type: string; status: string; vendor_id: string | null; po_sign_status: string; pf_sign_status: string; target_date: string | null }>(itemsRes)
    .map(i => ({
      id: i.id, type: i.type, status: i.status,
      hasVendor: !!i.vendor_id,
      poSignStatus: i.po_sign_status, pfSignStatus: i.pf_sign_status,
      targetDate: i.target_date,
    }));

  const changeRequests = rows<{ status: string }>(crRes);
  const pendingApprovals = rows<{ doc_type: string | null }>(apprRes);
  const followUps = rows<{ status: string; due_date: string }>(followUpRes);

  const pending: PendingCounts = {
    openApprovals:      pendingApprovals.length,
    openChangeRequests: changeRequests.filter(c => c.status === 'open' || c.status === 'under_review').length,
    overdueFollowUps:   followUps.filter(f => f.status === 'open' && f.due_date < today).length,
  };

  const handover = (handoverRes as { data: { status: string } | null }).data ?? null;
  const site     = (siteRes as { data: { overall_status: string } | null }).data ?? null;
  const plan     = (planRes as { data: { status: string; customer_accepted?: boolean } | null }).data ?? null;

  return assembleCockpit({
    project,
    lifecycle: {
      designJobs:      rows<{ status: string }>(designJobsRes),
      handover,
      siteReadiness:   site,
      changeRequests,
      items,
      pendingApprovals,
      deliveryPlan:    plan,
      now: today,
    },
    pending,
  }, projectId, role);
}
