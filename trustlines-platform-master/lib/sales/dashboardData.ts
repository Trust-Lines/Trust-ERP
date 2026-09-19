// Loads what the Sales dashboard shows. The pipeline lives in THREE tables (legacy lead_intake +
// Marketing's opportunities + prospect_potentials); they're merged exactly like the CRM board
// (app/(platform)/leads/page.tsx) so this page and the board can never disagree about pipeline size.
import { regionLabel } from '@/lib/regions';
import { loadOpportunityLeadRows } from '@/lib/marketing/opportunityRows';
import { loadPotentialLeadRows } from '@/lib/marketing/potentialRows';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import type { Lead } from '@/components/platform/leads/types';
import type { OpportunityStage } from '@/types/database';
import {
  isOpen, outcomes, pathBuckets, closingsByQuarter, regionRows, silentDeals, waitingBucket, POTENTIAL_STATUSES,
  type ActiveDealIn, type ActivityIn, type ClosedIn, type ClosingRow, type RegionRow, type SilentDeal, type StageBucket,
} from './dashboardMetrics';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SalesDashboardData {
  today: string;
  openDeals: number;
  openValue: number;
  potentials: number;
  tasks: { open: number; dueToday: number; overdue: number; unassigned: number };
  path: StageBucket[];
  waiting: { count: number; value: number };
  outcomes: ReturnType<typeof outcomes>;
  activeDeals: number;
  silentOver30: number;
  silent: SilentDeal[];
  regions: RegionRow[];
  closings: ClosingRow[];
  /** Closed deals with no usable close date — left out of the chart, counted here. */
  closingsUndated: number;
}

// Stages where a deal should be moving; "waiting" deals are meant to sit, so they aren't nagged here.
const ACTIVE_STAGES: OpportunityStage[] = ['sales_accepted', 'working_on_it_trust', 'proposal', 'negotiation'];

async function loadAllLeads(supabase: any, adm: any): Promise<Lead[]> {
  const { data: rows } = await adm
    .from('lead_intake')
    .select('id, assignee_id, deal_size, is_delivered, follow_up_date, opportunity_status, region, created_at, deleted_at, is_archived')
    .limit(2000);
  const intake = ((rows ?? []) as Record<string, unknown>[]).filter(r => !r.deleted_at && !r.is_archived);
  const intakeLeads: Lead[] = intake.map(r => ({
    id: r.id as string, name: '', industry: '', brand: '', state: '', priority: 'medium', design_status: '', request: '',
    project_type: '', location: '', date_created: (r.created_at as string) ?? '', source: 'lead_intake',
    contact: '', to_do: '', assignee: '', assignee_id: (r.assignee_id as string) ?? null,
    opportunity_status: (r.opportunity_status as Lead['opportunity_status']) ?? 'new_opportunity',
    deal_size: r.deal_size != null ? Number(r.deal_size) : null,
    follow_up_date: (r.follow_up_date as string) ?? null,
    region: (r.region as string) ?? null, origin: 'lead_intake',
  }));
  const [opps, pots] = await Promise.all([loadOpportunityLeadRows(supabase), loadPotentialLeadRows(supabase)]);
  return [...intakeLeads, ...opps, ...pots];
}

async function loadTaskCounts(adm: any, today: string) {
  const all: { status: string; due_date: string | null; assignee_id: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await adm.from('lead_tasks').select('status, due_date, assignee_id')
      .or('lead_intake_id.not.is.null,opportunity_id.not.is.null').range(from, from + 999);
    all.push(...((data ?? []) as typeof all));
    if (!data || data.length < 1000) break;
  }
  const open = all.filter(t => t.status !== 'done');
  return {
    open: open.length,
    dueToday: open.filter(t => t.due_date === today).length,
    overdue: open.filter(t => t.due_date != null && t.due_date < today).length,
    unassigned: open.filter(t => !t.assignee_id).length,
  };
}

/** Active deals + the last thing that happened on each (comments and logged changes). */
async function loadActiveDeals(adm: any): Promise<{ deals: ActiveDealIn[]; activity: Map<string, ActivityIn[]> }> {
  const { data } = await adm.from('opportunities')
    .select('id, title, region, stage, need_id, estimated_value, external_created_at, created_at')
    .is('deleted_at', null).in('stage', ACTIVE_STAGES).limit(1000);
  const opps = (data ?? []) as { id: string; title: string | null; region: string | null; stage: OpportunityStage; need_id: string | null; estimated_value: number | null; external_created_at: string | null; created_at: string }[];

  const needIds = opps.map(o => o.need_id).filter(Boolean) as string[];
  const oppIds = opps.map(o => o.id);
  const [notes, changes] = await Promise.all([
    fetchInChunks(needIds, chunk => adm.from('need_notes').select('need_id, author_name, body, source_created_at, created_at, external_source').in('need_id', chunk)),
    fetchInChunks(oppIds, chunk => adm.from('lead_activity').select('opportunity_id, body, created_at').in('opportunity_id', chunk)),
  ]);

  const oppByNeed = new Map(opps.filter(o => o.need_id).map(o => [o.need_id as string, o.id]));
  const activity = new Map<string, ActivityIn[]>();
  const push = (id: string | undefined, a: ActivityIn) => { if (!id) return; (activity.get(id) ?? activity.set(id, []).get(id)!).push(a); };
  for (const n of notes as { need_id: string; author_name: string | null; body: string; source_created_at: string | null; created_at: string; external_source: string | null }[]) {
    if (n.external_source === 'clickup_doc') continue; // an imported Doc isn't something that happened
    push(oppByNeed.get(n.need_id), { at: n.source_created_at ?? n.created_at, by: n.author_name, text: n.body });
  }
  for (const c of changes as { opportunity_id: string; body: string; created_at: string }[]) push(c.opportunity_id, { at: c.created_at, by: null, text: c.body });

  return {
    deals: opps.map(o => ({
      id: o.id, title: o.title?.trim() || 'Untitled', region: o.region, stageLabel: OPPORTUNITY_STAGE_LABEL[o.stage] ?? o.stage,
      dealSize: o.estimated_value, createdAt: o.external_created_at ?? o.created_at,
    })),
    activity,
  };
}

async function loadClosed(adm: any): Promise<ClosedIn[]> {
  const out: ClosedIn[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await adm.from('opportunities').select('stage, closed_at, created_at, external_created_at')
      .is('deleted_at', null).in('stage', ['closed_won', 'closed_lost']).range(from, from + 999);
    for (const o of (data ?? []) as { stage: string; closed_at: string | null; created_at: string; external_created_at: string | null }[]) {
      out.push({ won: o.stage === 'closed_won', closedAt: o.closed_at, createdAt: o.created_at, imported: !!o.external_created_at });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadSalesDashboard(supabase: any, adm: any): Promise<SalesDashboardData> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [leads, tasks, active, closed] = await Promise.all([loadAllLeads(supabase, adm), loadTaskCounts(adm, today), loadActiveDeals(adm), loadClosed(adm)]);
  const closings = closingsByQuarter(closed);

  const open = leads.filter(isOpen);
  const silentAll = silentDeals(active.deals, active.activity, now);

  return {
    today,
    openDeals: open.length,
    openValue: open.reduce((s, l) => s + (l.deal_size ?? 0), 0),
    potentials: leads.filter(l => POTENTIAL_STATUSES.includes(l.opportunity_status)).length,
    tasks,
    path: pathBuckets(leads),
    waiting: waitingBucket(leads),
    outcomes: outcomes(leads),
    activeDeals: active.deals.length,
    silentOver30: silentAll.filter(d => d.daysSilent > 30).length,
    silent: silentAll.slice(0, 10),
    regions: regionRows(leads, regionLabel),
    closings: closings.rows,
    closingsUndated: closings.undated,
  };
}
