
import { logAudit } from '@/lib/audit/log';
import { scopeToCategories } from '@/lib/sales/scope';
import {
  REGION_CODES, SERVICE_LINE_VALUES,
  dropboxRegionFolder, dropboxSectionForServiceLine, composeProjectCode,
} from '@/lib/regions';
import { buildDropboxProjectPath } from '@/lib/dropbox/paths';
import { createProjectFolders } from '@/lib/dropbox/upload';
import { reserveFreeProjectNumber } from '@/lib/projects/number';
import { createTrustProject } from '@/lib/trust/createProject';
import type { ScopeType } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Marketing → Sales → Closed Deal. The project opens when the deal is WON, not before:
//   handoff (Marketing) → Accept (Sales takes it on) → Design → customer approval → Close Won.
// Close Won opens the project with the next free number (lib/projects/number), links the
// customer, gives it to the region's T-Lines PM, opens it in the Trust System and links the
// drawings the customer approved — so the T-Lines PM and the Trust Lines team pick it up from there.

const OPP_COLS = 'id, prospect_id, need_id, title, project_id, stage, scope_types, sales_owner_id, '
  + 'sales_handoff_at, sales_accepted_at, closed_at, closed_reason, return_reason, customer_id';

export class HandoffError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function initiateHandoff(admin: any, opportunityId: string, actorId: string, salesOwnerId: string | null): Promise<Record<string, unknown>> {
  const { data: opp } = await admin.from('opportunities').select(OPP_COLS).eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!opp) throw new HandoffError('Not found', 404);
  if (!['new', 'marketing_qualification'].includes(opp.stage)) {
    throw new HandoffError(`Cannot hand off an Opportunity in stage "${opp.stage}"`, 409);
  }
  const { data } = await admin.from('opportunities').update({
    stage: 'sales_handoff', sales_handoff_at: new Date().toISOString(),
    sales_owner_id: salesOwnerId, return_reason: null,
  }).eq('id', opportunityId).select(OPP_COLS).maybeSingle();
  await logAudit({ actorId, action: 'opportunity.handoff', resource: `opportunity:${opportunityId}`, newValue: { sales_owner_id: salesOwnerId } });
  return data;
}

function composeAddress(city?: string | null, street?: string | null, state?: string | null): string {
  return [city, street, state].map(s => (s ?? '').trim()).filter(Boolean).join(' - ');
}

/** What a project is opened with (the Close Won form). */
export interface ProjectInput {
  region: string;
  serviceLine: string;
  city: string;
  street?: string;
  state: string;
  customerName: string;
}
/** @deprecated the Accept step no longer opens the project — see ProjectInput / closeWon. */
export type AcceptInput = ProjectInput;

/** Sales takes the Opportunity on. No project yet — that opens when the deal is won. */
export async function acceptOpportunity(admin: any, opportunityId: string, actorId: string): Promise<{ opportunity: Record<string, unknown>; project: Record<string, unknown> | null; alreadyAccepted: boolean }> {
  const { data: opp } = await admin.from('opportunities').select(OPP_COLS).eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!opp) throw new HandoffError('Not found', 404);
  if (opp.stage !== 'sales_handoff') {
    if (opp.sales_accepted_at) return { opportunity: opp, project: null, alreadyAccepted: true };
    throw new HandoffError(`Cannot accept an Opportunity in stage "${opp.stage}" — it must be in Sales Handoff`, 409);
  }
  const { data: updatedOpp } = await admin.from('opportunities').update({
    stage: 'sales_accepted', sales_accepted_at: new Date().toISOString(), sales_owner_id: actorId,
  }).eq('id', opportunityId).select(OPP_COLS).maybeSingle();
  await logAudit({ actorId, action: 'opportunity.accepted', resource: `opportunity:${opportunityId}` });
  return { opportunity: updatedOpp, project: null, alreadyAccepted: false };
}

export async function returnOpportunity(admin: any, opportunityId: string, actorId: string, reason: string): Promise<Record<string, unknown>> {
  if (!reason?.trim()) throw new HandoffError('A reason is required to return an Opportunity to Marketing');
  const { data: opp } = await admin.from('opportunities').select(OPP_COLS).eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!opp) throw new HandoffError('Not found', 404);
  if (opp.stage !== 'sales_handoff') throw new HandoffError(`Cannot return an Opportunity in stage "${opp.stage}"`, 409);

  const { data } = await admin.from('opportunities').update({
    stage: 'marketing_qualification', return_reason: reason.trim(), sales_owner_id: null,
  }).eq('id', opportunityId).select(OPP_COLS).maybeSingle();
  await logAudit({ actorId, action: 'opportunity.returned', resource: `opportunity:${opportunityId}`, newValue: { reason } });
  return data;
}

export async function resolveOrCreateCustomerForProspect(
  admin: any, prospectId: string, actorId: string,
): Promise<{ customerId: string | null; displayName: string | null }> {
  const { data: prospect } = await admin.from('prospects')
    .select('id, customer_id, display_name, main_email, main_phone').eq('id', prospectId).maybeSingle();
  if (!prospect) return { customerId: null, displayName: null };
  if (prospect.customer_id) return { customerId: prospect.customer_id, displayName: prospect.display_name ?? null };

  const { data: existing } = await admin.from('customers')
    .select('id').ilike('name', prospect.display_name).limit(1).maybeSingle();
  let customerId: string;
  if (existing) {
    customerId = existing.id;
  } else {
    const { data: created, error: cErr } = await admin.from('customers').insert({
      name: prospect.display_name, email: prospect.main_email, phone: prospect.main_phone,
      status: 'active', created_by: actorId,
    }).select('id').single();
    if (cErr) throw new HandoffError(cErr.message, 500);
    customerId = created.id;
  }
  await admin.from('prospects').update({ customer_id: customerId }).eq('id', prospectId);
  return { customerId, displayName: prospect.display_name ?? null };
}

/**
 * Opens the Opportunity's project: next free number, Dropbox folders, the row, linked to the
 * Opportunity (a concurrent call that got there first wins — its project is returned instead).
 */
async function openProject(admin: any, opp: Record<string, any>, input: ProjectInput, customerId: string | null, actorId: string): Promise<{ project: Record<string, any>; number: number; categories: string[]; alreadyExisted: boolean }> {
  let number: number;
  try { number = await reserveFreeProjectNumber(admin); }
  catch (e) { throw new HandoffError(e instanceof Error ? e.message : 'Could not reserve a project number', 503); }

  const code = composeProjectCode(input.serviceLine, input.region, number);
  const addr = composeAddress(input.city, input.street, input.state);
  const dropboxParams = {
    dropboxSection: dropboxSectionForServiceLine(input.serviceLine),
    dropboxRegion: dropboxRegionFolder(input.region),
    dropboxStatus: 'Under Working',
    dropboxClientType: 'Clients',
    dropboxClientName: input.customerName || 'Customer',
    projectNo: code,
    address: addr,
  };
  const { projectFolderPath } = buildDropboxProjectPath(dropboxParams);
  const categories = scopeToCategories(Object.fromEntries(((opp.scope_types ?? []) as ScopeType[]).map(t => [t, true])));

  const { data: project, error: pErr } = await admin.from('projects').insert({
    code, name: `${code} - ${addr}`,
    region: input.region, service_line: input.serviceLine, site_location: addr, categories,
    is_draft: false, current_stage: 'closed_deal', current_phase: 'finalization',
    dropbox_root_path: projectFolderPath, created_by: actorId,
    is_archived: false, hard_deadline: false, customer_id: customerId,
  }).select('*').single();
  if (pErr || !project) throw new HandoffError(pErr?.message ?? 'Failed to create project', 500);

  try { await createProjectFolders(dropboxParams as any, categories); }
  catch (e) { console.error('[sales-handoff] dropbox folders pending:', e instanceof Error ? e.message : e); }

  const { data: linked } = await admin.from('opportunities')
    .update({ project_id: project.id, customer_id: customerId })
    .eq('id', opp.id).is('project_id', null).select('project_id').maybeSingle();
  if (!linked) {
    await logAudit({ actorId, action: 'opportunity.project_bridge_race_discarded', projectId: project.id, resource: `opportunity:${opp.id}`, newValue: { code } });
    const { data: winner } = await admin.from('opportunities').select('project_id').eq('id', opp.id).maybeSingle();
    const { data: winnerProject } = await admin.from('projects').select('*').eq('id', winner.project_id).maybeSingle();
    return { project: winnerProject, number, categories, alreadyExisted: true };
  }
  return { project, number, categories, alreadyExisted: false };
}

/** The project details the Opportunity's Need / Location / Contact already hold — null when any is missing. */
async function projectInputFromNeed(admin: any, opp: Record<string, any>): Promise<ProjectInput | null> {
  const [{ data: need }, { data: prospect }] = await Promise.all([
    admin.from('prospect_needs').select('region, service_line, state, location_id').eq('id', opp.need_id).maybeSingle(),
    admin.from('prospects').select('display_name').eq('id', opp.prospect_id).maybeSingle(),
  ]);
  let city: string | null = null;
  if (need?.location_id) {
    const { data: loc } = await admin.from('prospect_locations').select('city').eq('id', need.location_id).maybeSingle();
    city = loc?.city ?? null;
  }
  const region = opp.region ?? need?.region ?? null;
  if (!region || !need?.service_line || !need?.state || !city || !prospect?.display_name) return null;
  return { region, serviceLine: need.service_line, city, state: need.state, customerName: prospect.display_name };
}

function checkInput(input: ProjectInput) {
  if (!REGION_CODES.includes(input.region)) throw new HandoffError('Invalid region');
  if (!SERVICE_LINE_VALUES.includes(input.serviceLine)) throw new HandoffError('Invalid service line');
  if (!input.city?.trim() || !input.state?.trim() || !input.customerName?.trim()) {
    throw new HandoffError('City, state and customer name are required to open the project');
  }
}

/**
 * The deal is won. Without a project yet, `input` opens it (Close Won form); then the customer
 * is linked, the region's T-Lines PM assigned, the project opened in the Trust System and the
 * approved drawings linked. Idempotent: an already-won Opportunity is returned as it is.
 */
export async function closeWon(admin: any, opportunityId: string, actorId: string, input?: ProjectInput): Promise<Record<string, unknown>> {
  const { data: opp } = await admin.from('opportunities').select(OPP_COLS + ', region').eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!opp) throw new HandoffError('Not found', 404);
  if (opp.stage === 'closed_won') return opp;
  // No form sent: what the Need / Location already say, when that's complete.
  if (!opp.project_id && !input) input = (await projectInputFromNeed(admin, opp)) ?? undefined;
  if (!opp.project_id && !input) throw new HandoffError('Enter the project details (region, service line, city, state, customer) to close this deal as Won', 409);
  if (!opp.project_id) checkInput(input!);

  let customerId: string | null = opp.customer_id;
  if (!customerId) ({ customerId } = await resolveOrCreateCustomerForProspect(admin, opp.prospect_id, actorId));

  let projectId: string = opp.project_id;
  let opened: { number: number; categories: string[]; region: string; name: string; address: string } | null = null;
  if (!projectId) {
    const r = await openProject(admin, opp, input!, customerId, actorId);
    projectId = r.project.id;
    if (!r.alreadyExisted) {
      opened = { number: r.number, categories: r.categories, region: input!.region, name: input!.customerName.trim(), address: r.project.site_location };
      await logAudit({ actorId, action: 'opportunity.project_opened_on_won', projectId, resource: `opportunity:${opportunityId}`, newValue: { code: r.project.code } });
    }
  } else if (customerId) {
    await admin.from('projects').update({ customer_id: customerId }).eq('id', projectId);
  }

  const { data } = await admin.from('opportunities').update({
    stage: 'closed_won', closed_at: new Date().toISOString(), customer_id: customerId,
  }).eq('id', opportunityId).select(OPP_COLS).maybeSingle();
  await logAudit({ actorId, action: 'opportunity.closed_won', projectId, resource: `opportunity:${opportunityId}`, newValue: { customer_id: customerId } });

  // The hand-over steps never undo the win — each one that can't be done is flagged to ops.
  const problems: string[] = [];
  try { await assignRegionalPm(admin, projectId, actorId, problems); }
  catch (e) { problems.push(`T-Lines PM: ${e instanceof Error ? e.message : e}`); }
  if (opened) {
    const t = await createTrustProject({ region: opened.region, projectNo: opened.number, name: opened.name, address: opened.address, types: opened.categories });
    if (!t.ok) problems.push(`not opened in the Trust System (${t.error}) — add it on the Production board`);
    else await logAudit({ actorId, action: t.existed ? 'project.trust_already_there' : 'project.opened_in_trust', projectId, newValue: { projectNo: opened.number } });
  }
  try { await linkApprovedDrawings(admin, opportunityId, projectId, actorId); }
  catch (e) { console.error('[sales-handoff] approved drawings not linked:', e instanceof Error ? e.message : e); }
  if (problems.length) {
    try { await notifyOps(admin, projectId, actorId, problems); }
    catch (e) { console.error('[sales-handoff] closeWon notice failed:', e instanceof Error ? e.message : e); }
  }
  return data;
}

/** The project goes to the T-Lines PM of its region (Team → their regions) when there's exactly one. */
async function assignRegionalPm(admin: any, projectId: string, actorId: string, problems: string[]): Promise<void> {
  const { data: project } = await admin.from('projects').select('code, region, tlines_pm_id').eq('id', projectId).maybeSingle();
  if (!project || project.tlines_pm_id) return;
  const { data: pms } = await admin.from('profiles').select('id, full_name, assigned_regions').eq('role', 'tlines_pm').eq('is_active', true);
  const ofRegion = ((pms ?? []) as { id: string; full_name: string; assigned_regions: string[] | null }[])
    .filter(p => !!project.region && (p.assigned_regions ?? []).includes(project.region));
  if (ofRegion.length !== 1) {
    problems.push(ofRegion.length
      ? `no T-Lines PM assigned — ${ofRegion.length} PMs cover this region (${ofRegion.map(p => p.full_name).join(', ')}), pick one`
      : 'no T-Lines PM assigned — nobody covers this region yet (Team → their regions)');
    return;
  }
  const pm = ofRegion[0];
  await admin.from('projects').update({ tlines_pm_id: pm.id }).eq('id', projectId).is('tlines_pm_id', null);
  await logAudit({ actorId, action: 'project.tlines_pm_auto_assigned', projectId, newValue: { tlines_pm_id: pm.id } });
  await admin.from('notifications').insert({
    user_id: pm.id, project_id: projectId, type: 'project',
    title: 'New project for you', body: `${project.code ?? 'A project'} was just won and is yours to follow.`,
    link: `/projects/${projectId}`,
  });
}

/** The drawings the customer approved on the review link become the project's documents. */
async function linkApprovedDrawings(admin: any, opportunityId: string, projectId: string, actorId: string): Promise<void> {
  const { data: job } = await admin.from('sales_design_jobs').select('id').eq('opportunity_id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!job) return;
  const { data: version } = await admin.from('sales_design_versions').select('id').eq('job_id', job.id).eq('status', 'approved')
    .order('version_no', { ascending: false }).limit(1).maybeSingle();
  if (!version) return;
  const { linkDesignFilesToProject } = await import('@/lib/sales/designDocs');
  await linkDesignFilesToProject(admin, version.id, projectId, actorId);
}

async function notifyOps(admin: any, projectId: string, actorId: string, problems: string[]): Promise<void> {
  const { data: project } = await admin.from('projects').select('code').eq('id', projectId).maybeSingle();
  const { data: recipients } = await admin.from('profiles')
    .select('id').in('role', ['ops_manager', 'general_manager']).eq('is_active', true);
  const rows = ((recipients ?? []) as { id: string }[])
    .filter(r => r.id !== actorId)
    .map(r => ({
      user_id: r.id, project_id: projectId, type: 'project',
      title: `${project?.code ?? 'A new project'} needs a hand`,
      body: `Won and opened, but: ${problems.join('; ')}.`,
      link: `/projects/${projectId}/edit`,
    }));
  if (rows.length) await admin.from('notifications').insert(rows);
}

export interface EnsureProjectResult {
  project: Record<string, unknown>;
  alreadyExisted: boolean;
}

/**
 * Opens a project from what the Opportunity's Need / Location already say (region, service line,
 * state, city) — for a won deal whose details are on file. Idempotent.
 */
export async function ensureProjectForOpportunity(admin: any, opportunityId: string, actorId: string): Promise<EnsureProjectResult> {
  const { data: opp } = await admin.from('opportunities').select(OPP_COLS + ', region').eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!opp) throw new HandoffError('Not found', 404);

  if (opp.project_id) {
    const { data: project } = await admin.from('projects').select('*').eq('id', opp.project_id).maybeSingle();
    return { project, alreadyExisted: true };
  }

  const { data: need } = await admin.from('prospect_needs')
    .select('id, region, service_line, state, location_id').eq('id', opp.need_id).maybeSingle();
  const region: string | null = opp.region ?? need?.region ?? null;
  const serviceLine: string | null = need?.service_line ?? null;
  const state: string | null = need?.state ?? null;
  let city: string | null = null;
  if (need?.location_id) {
    const { data: loc } = await admin.from('prospect_locations').select('city').eq('id', need.location_id).maybeSingle();
    city = loc?.city ?? null;
  }

  const missing = [
    !region && 'region', !serviceLine && 'service line', !state && 'state', !city && 'city',
  ].filter(Boolean) as string[];
  if (missing.length) {
    throw new HandoffError(
      `Cannot open a Project — missing ${missing.join(', ')} on this Opportunity's Need/Location. Set it there first.`, 409,
    );
  }
  if (!REGION_CODES.includes(region!)) throw new HandoffError(`Invalid region "${region}" on this Opportunity's Need`, 409);
  if (!SERVICE_LINE_VALUES.includes(serviceLine!)) throw new HandoffError(`Invalid service line "${serviceLine}" on this Opportunity's Need`, 409);

  const { customerId, displayName } = await resolveOrCreateCustomerForProspect(admin, opp.prospect_id, actorId);
  const r = await openProject(admin, opp, { region: region!, serviceLine: serviceLine!, city: city!, state: state!, customerName: displayName || 'Customer' }, customerId, actorId);
  if (!r.alreadyExisted) {
    await logAudit({
      actorId, action: 'opportunity.project_opened_via_stage_bridge', projectId: r.project.id,
      resource: `opportunity:${opportunityId}`, newValue: { code: r.project.code, region, service_line: serviceLine, customer_id: customerId },
    });
  }
  return { project: r.project, alreadyExisted: r.alreadyExisted };
}

export async function closeLost(admin: any, opportunityId: string, actorId: string, reason: string): Promise<Record<string, unknown>> {
  if (!reason?.trim()) throw new HandoffError('A reason is required to close an Opportunity as Lost');
  const { data: opp } = await admin.from('opportunities').select(OPP_COLS).eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!opp) throw new HandoffError('Not found', 404);
  if (opp.stage === 'closed_lost') return opp;

  const { data } = await admin.from('opportunities').update({
    stage: 'closed_lost', closed_at: new Date().toISOString(), closed_reason: reason.trim(),
  }).eq('id', opportunityId).select(OPP_COLS).maybeSingle();
  await logAudit({ actorId, action: 'opportunity.closed_lost', resource: `opportunity:${opportunityId}`, newValue: { reason } });
  return data;
}
