
import { logAudit } from '@/lib/audit/log';
import { scopeToCategories } from '@/lib/sales/scope';
import {
  REGION_CODES, SERVICE_LINE_VALUES,
  dropboxRegionFolder, dropboxSectionForServiceLine, composeProjectCode,
} from '@/lib/regions';
import { buildDropboxProjectPath } from '@/lib/dropbox/paths';
import { createProjectFolders } from '@/lib/dropbox/upload';
import type { ScopeType } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

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

export interface AcceptInput {
  region: string;
  serviceLine: string;
  city: string;
  street?: string;
  state: string;
  customerName: string;
}

export async function acceptOpportunity(admin: any, opportunityId: string, actorId: string, input: AcceptInput): Promise<{ opportunity: Record<string, unknown>; project: Record<string, unknown>; alreadyAccepted: boolean }> {
  const { data: opp } = await admin.from('opportunities').select(OPP_COLS).eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!opp) throw new HandoffError('Not found', 404);

  if (opp.project_id) {
    const { data: project } = await admin.from('projects').select('*').eq('id', opp.project_id).maybeSingle();
    return { opportunity: opp, project, alreadyAccepted: true };
  }
  if (opp.stage !== 'sales_handoff') {
    throw new HandoffError(`Cannot accept an Opportunity in stage "${opp.stage}" — it must be in Sales Handoff`, 409);
  }
  if (!REGION_CODES.includes(input.region)) throw new HandoffError('Invalid region');
  if (!SERVICE_LINE_VALUES.includes(input.serviceLine)) throw new HandoffError('Invalid service line');
  if (!input.city?.trim() || !input.state?.trim() || !input.customerName?.trim()) {
    throw new HandoffError('City, state, and customer name are required to accept');
  }

  const { data: reserved, error: rErr } = await admin.rpc('reserve_global_number');
  if (rErr) throw new HandoffError(rErr.message, 500);
  const reservedNumber = reserved as number;

  const code = composeProjectCode(input.serviceLine, input.region, reservedNumber);
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

  const scopeFlags = Object.fromEntries(((opp.scope_types ?? []) as ScopeType[]).map(t => [t, true]));
  const categories = scopeToCategories(scopeFlags);

  const { data: project, error: pErr } = await admin.from('projects').insert({
    code, name: `${code} - ${addr}`,
    region: input.region, service_line: input.serviceLine, site_location: addr, categories,
    is_draft: false, current_stage: 'closed_deal', current_phase: 'finalization',
    dropbox_root_path: projectFolderPath, created_by: actorId,
    is_archived: false, hard_deadline: false,
  }).select('*').single();
  if (pErr || !project) throw new HandoffError(pErr?.message ?? 'Failed to create project', 500);

  try {
    await createProjectFolders(dropboxParams as any, categories);
  } catch (e) {
    console.error('[sales-handoff] dropbox folders pending:', e instanceof Error ? e.message : e);
  }

  const { data: updatedOpp } = await admin.from('opportunities').update({
    project_id: project.id, stage: 'sales_accepted', sales_accepted_at: new Date().toISOString(),
    sales_owner_id: actorId,
  }).eq('id', opportunityId).select(OPP_COLS).maybeSingle();

  await logAudit({
    actorId, action: 'opportunity.accepted', projectId: project.id, resource: `opportunity:${opportunityId}`,
    newValue: { code, region: input.region, service_line: input.serviceLine },
  });

  return { opportunity: updatedOpp, project, alreadyAccepted: false };
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

async function resolveOrCreateCustomerForProspect(
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

export async function closeWon(admin: any, opportunityId: string, actorId: string): Promise<Record<string, unknown>> {
  const { data: opp } = await admin.from('opportunities').select(OPP_COLS).eq('id', opportunityId).is('deleted_at', null).maybeSingle();
  if (!opp) throw new HandoffError('Not found', 404);
  if (opp.stage === 'closed_won') return opp;
  if (!opp.project_id) throw new HandoffError('Cannot close Won before this Opportunity has been accepted (no Project exists yet)', 409);

  let customerId: string | null = opp.customer_id;
  if (!customerId) {
    ({ customerId } = await resolveOrCreateCustomerForProspect(admin, opp.prospect_id, actorId));
  }
  if (customerId) await admin.from('projects').update({ customer_id: customerId }).eq('id', opp.project_id);

  const { data } = await admin.from('opportunities').update({
    stage: 'closed_won', closed_at: new Date().toISOString(), customer_id: customerId,
  }).eq('id', opportunityId).select(OPP_COLS).maybeSingle();
  await logAudit({ actorId, action: 'opportunity.closed_won', projectId: opp.project_id, resource: `opportunity:${opportunityId}`, newValue: { customer_id: customerId } });

  // 🔴 FIX: Closed Won never assigned a T-Lines PM / Trust-Lines PM to the project, and neither
  // does Accept — no automated project-creation path ever sets projects.tlines_pm_id /
  // trustlines_pm_id (only the manual "New Project" form's regional lookup does, and that in turn
  // depends on `clients` rows this dev DB currently has zero of). A newly-won project could sit
  // with no PM and nobody would notice. Rather than guess a regional PM from an unpopulated table
  // (real risk: assigning the wrong T-Lines PM would leak that project's visibility to the wrong
  // customer's PM), flag it to ops/management so a human assigns the right one deliberately.
  try {
    await notifyUnassignedPmOnProject(admin, opp.project_id as string, actorId);
  } catch (e) {
    console.error('[sales-handoff] closeWon PM-assignment notice failed:', e instanceof Error ? e.message : e);
  }

  return data;
}

async function notifyUnassignedPmOnProject(admin: any, projectId: string, actorId: string): Promise<void> {
  const { data: project } = await admin.from('projects').select('code, tlines_pm_id, trustlines_pm_id').eq('id', projectId).maybeSingle();
  if (!project || (project.tlines_pm_id && project.trustlines_pm_id)) return; // already has both — nothing to flag

  const { data: recipients } = await admin.from('profiles')
    .select('id').in('role', ['ops_manager', 'general_manager']).eq('is_active', true);
  const rows = ((recipients ?? []) as { id: string }[])
    .filter(r => r.id !== actorId)
    .map(r => ({
      user_id: r.id, project_id: projectId, type: 'project',
      title: 'New project needs a PM assigned',
      body: `${project.code ?? 'A project'} was just Closed Won and has no T-Lines PM / Trust-Lines PM yet.`,
      link: `/projects/${projectId}/edit`,
    }));
  if (rows.length) await admin.from('notifications').insert(rows);
}

export interface EnsureProjectResult {
  project: Record<string, unknown>;
  alreadyExisted: boolean;
}

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
      `Cannot open a Project for "Working on it Trust" — missing ${missing.join(', ')} on this Opportunity's Need/Location. `
      + 'Set it there first, then move the stage again.', 409,
    );
  }
  if (!REGION_CODES.includes(region!)) throw new HandoffError(`Invalid region "${region}" on this Opportunity's Need`, 409);
  if (!SERVICE_LINE_VALUES.includes(serviceLine!)) throw new HandoffError(`Invalid service line "${serviceLine}" on this Opportunity's Need`, 409);

  const { customerId, displayName } = await resolveOrCreateCustomerForProspect(admin, opp.prospect_id, actorId);

  const { data: reserved, error: rErr } = await admin.rpc('reserve_global_number');
  if (rErr) throw new HandoffError(rErr.message, 500);
  const reservedNumber = reserved as number;

  const code = composeProjectCode(serviceLine!, region!, reservedNumber);
  const addr = composeAddress(city, null, state);
  const dropboxParams = {
    dropboxSection: dropboxSectionForServiceLine(serviceLine!),
    dropboxRegion: dropboxRegionFolder(region!),
    dropboxStatus: 'Under Working',
    dropboxClientType: 'Clients',
    dropboxClientName: displayName || 'Customer',
    projectNo: code,
    address: addr,
  };
  const { projectFolderPath } = buildDropboxProjectPath(dropboxParams);

  const scopeFlags = Object.fromEntries(((opp.scope_types ?? []) as ScopeType[]).map(t => [t, true]));
  const categories = scopeToCategories(scopeFlags);

  const { data: project, error: pErr } = await admin.from('projects').insert({
    code, name: `${code} - ${addr}`,
    region, service_line: serviceLine, site_location: addr, categories,
    is_draft: false, current_stage: 'closed_deal', current_phase: 'finalization',
    dropbox_root_path: projectFolderPath, created_by: actorId,
    is_archived: false, hard_deadline: false,
    customer_id: customerId,
  }).select('*').single();
  if (pErr || !project) throw new HandoffError(pErr?.message ?? 'Failed to create project', 500);

  try {
    await createProjectFolders(dropboxParams as any, categories);
  } catch (e) {
    console.error('[sales-handoff] dropbox folders pending (working_on_it_trust bridge):', e instanceof Error ? e.message : e);
  }

  const { data: linkedOpp } = await admin.from('opportunities')
    .update({ project_id: project.id, customer_id: customerId })
    .eq('id', opportunityId).is('project_id', null)
    .select('project_id').maybeSingle();

  if (!linkedOpp) {
    await logAudit({
      actorId, action: 'opportunity.project_bridge_race_discarded', projectId: project.id,
      resource: `opportunity:${opportunityId}`, newValue: { code },
    });
    const { data: winner } = await admin.from('opportunities').select('project_id').eq('id', opportunityId).maybeSingle();
    const { data: winnerProject } = await admin.from('projects').select('*').eq('id', winner.project_id).maybeSingle();
    return { project: winnerProject, alreadyExisted: true };
  }

  await logAudit({
    actorId, action: 'opportunity.project_opened_via_stage_bridge', projectId: project.id,
    resource: `opportunity:${opportunityId}`, newValue: { code, region, service_line: serviceLine, customer_id: customerId },
  });

  return { project, alreadyExisted: false };
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
