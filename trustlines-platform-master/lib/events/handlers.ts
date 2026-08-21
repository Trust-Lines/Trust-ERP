
import { logAudit } from '@/lib/audit/log';
import { registerHandler } from './bus';
import { notifyUsers, emailUsersWithPerm, usersWithRoles, appUrl } from './notify';
import { ruleFor, audienceFor } from '@/lib/notify/matrix';
import { defaultChecklist } from '@/lib/handover/checklist';
import type { SystemEvent } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ProjectRow {
  id: string; code: string; name: string;
  tlines_pm_id: string | null;
  trustlines_pm_id: string | null;
  customer_id: string | null;
}

const PROJECT_COLS = 'id, code, name, tlines_pm_id, trustlines_pm_id, customer_id';

async function loadProject(admin: any, projectId: string | null): Promise<ProjectRow | null> {
  if (!projectId) return null;
  const { data } = await admin.from('projects').select(PROJECT_COLS).eq('id', projectId).maybeSingle();
  return (data as ProjectRow | null) ?? null;
}

async function notifyByMatrix(admin: any, p: {
  eventKey: string;
  project: ProjectRow | null;
  actorId: string | null;
  title: string;
  body: string;
  link: string;
  extraUserIds?: (string | null | undefined)[];
  emailSubject?: string;
  emailHtml?: (name: string) => string;
  emailUserIds?: (string | null | undefined)[];
}): Promise<string[]> {
  const rule = ruleFor(p.eventKey);
  if (!rule) return [];

  const audience = await audienceFor(admin, rule, p.project as unknown as Record<string, unknown>, usersWithRoles);
  const notified = await notifyUsers(admin, {
    userIds:   [...audience, ...(p.extraUserIds ?? [])],
    projectId: p.project?.id ?? null,
    actorId:   p.actorId,
    type:      rule.type,
    title:     p.title,
    body:      p.body,
    link:      p.link,
  });

  if (rule.emailPerm && p.emailSubject && p.emailHtml) {
    const targets = p.emailUserIds
      ? p.emailUserIds.filter((id): id is string => !!id)
      : notified;
    await emailUsersWithPerm(admin, {
      userIds: targets,
      permKey: rule.emailPerm,
      subject: p.emailSubject,
      html:    p.emailHtml,
    });
  }
  return notified;
}

export async function onLeadClosedWon(admin: any, event: SystemEvent): Promise<void> {
  const project = await loadProject(admin, event.project_id);
  if (!project) return;

  let handoverCreated = false;
  const { data: existing } = await admin.from('project_handovers')
    .select('id').eq('project_id', project.id).maybeSingle();

  if (!existing) {
    const { error } = await admin.from('project_handovers').insert({
      project_id: project.id,
      checklist:  defaultChecklist(),
      created_by: event.actor_id,
    });
    if (error && error.code !== '23505') {
      console.error('[A1] handover create failed:', error.message);
    } else if (!error) {
      handoverCreated = true;
    }
  }

  const notified = await notifyByMatrix(admin, {
    eventKey: 'lead.closed_won',
    project, actorId: event.actor_id,
    title: `Handover ready: ${project.code}`,
    body:  `${project.name} moved to Trust-Lines. Start the handover checklist.`,
    link:  `/projects/${project.id}/handover`,
  });

  let followUpCreated = false;
  if (project.customer_id) {
    const note = `First finalization meeting — ${project.code}`;
    const { data: dupe } = await admin.from('customer_follow_ups')
      .select('id').eq('project_id', project.id).eq('note', note).is('deleted_at', null).maybeSingle();

    if (!dupe) {
      const due = new Date();
      due.setDate(due.getDate() + 7);
      const { error } = await admin.from('customer_follow_ups').insert({
        customer_id: project.customer_id,
        project_id:  project.id,
        note,
        due_date:    due.toISOString().slice(0, 10),
        assignee_id: project.tlines_pm_id,
        status:      'open',
        created_by:  event.actor_id,
      });
      if (error) console.error('[A1] follow-up create failed:', error.message);
      else followUpCreated = true;
    }
  }

  await logAudit({
    actorId: event.actor_id, action: 'automation.a1_lead_closed_won', projectId: project.id,
    resource: `system_event:${event.id}`,
    newValue: { handoverCreated, followUpCreated, notified: notified.length },
  });
}

export async function onHandoverReady(admin: any, event: SystemEvent): Promise<void> {
  const project = await loadProject(admin, event.project_id);
  if (!project) return;

  const notified = await notifyByMatrix(admin, {
    eventKey: 'handover.ready',
    project, actorId: event.actor_id,
    title: `Handover complete: ${project.code}`,
    body:  `Every handover item is green. ${project.name} is ready to move to Finalization.`,
    link:  `/projects/${project.id}/finalization`,
  });

  await logAudit({
    actorId: event.actor_id, action: 'automation.a2_handover_ready', projectId: project.id,
    resource: `system_event:${event.id}`,
    newValue: { notified: notified.length, stageForced: false },
  });
}

export async function onProjectItemsReady(admin: any, event: SystemEvent): Promise<void> {
  const project = await loadProject(admin, event.project_id);
  if (!project) return;

  const link = `/projects/${project.id}/delivery`;

  let planMissing = false;
  try {
    const { data: plan, error } = await admin.from('delivery_plans')
      .select('id').eq('project_id', project.id).maybeSingle();
    if (!error) planMissing = !plan;
    else console.warn('[A5] delivery plan check skipped:', error.message);
  } catch (e) {
    console.warn('[A5] delivery plan check threw:', e instanceof Error ? e.message : e);
  }

  const body = planMissing
    ? `All items for ${project.name} are SENT. No delivery plan exists yet — create one to schedule the build.`
    : `All items for ${project.name} are SENT and ready for delivery.`;

  const notified = await notifyByMatrix(admin, {
    eventKey: 'project.items_ready',
    project,
    actorId: null,
    title: `Items are ready: ${project.code}`,
    body, link,
    emailUserIds: [project.tlines_pm_id],
    emailSubject: `Items are ready — ${project.code}`,
    emailHtml: (name: string) =>
      `<p>Hi ${name},</p>` +
      `<p>All production items for <strong>${project.name}</strong> (${project.code}) are marked SENT.</p>` +
      (planMissing ? `<p>There is no delivery plan yet — create one to schedule the build.</p>` : '') +
      `<p><a href="${appUrl()}${link}">Open delivery →</a></p>`,
  });

  await logAudit({
    actorId: null, action: 'automation.a5_items_ready', projectId: project.id,
    resource: `system_event:${event.id}`,
    newValue: { notified: notified.length, planMissing },
  });
}

export async function onSiteReady(admin: any, event: SystemEvent): Promise<void> {
  const project = await loadProject(admin, event.project_id);
  if (!project) return;

  const notified = await notifyByMatrix(admin, {
    eventKey: 'site.ready',
    project, actorId: event.actor_id,
    title: `Site ready: ${project.code}`,
    body:  `The site for ${project.name} is ready. Delivery and build can be scheduled.`,
    link:  `/projects/${project.id}/delivery`,
  });

  await logAudit({
    actorId: event.actor_id, action: 'automation.a3_site_ready', projectId: project.id,
    resource: `system_event:${event.id}`, newValue: { notified: notified.length },
  });
}

export async function onPoChainComplete(admin: any, event: SystemEvent): Promise<void> {
  const project = await loadProject(admin, event.project_id);
  if (!project) return;

  const typeName = typeof event.payload?.typeName === 'string' ? event.payload.typeName : null;

  let q = admin.from('production_items')
    .select('id, type, vendor_id')
    .eq('project_id', project.id).eq('source', 'project').is('deleted_at', null);
  if (typeName) q = q.eq('type', typeName);

  const { data: items, error } = await q as {
    data: { id: string; type: string; vendor_id: string | null }[] | null;
    error: { message: string } | null;
  };
  if (error) { console.error('[A4] item lookup failed:', error.message); return; }

  const awaitingVendor = (items ?? []).filter(i => !i.vendor_id);
  const link = `/projects/${project.id}/types`;

  const notified = awaitingVendor.length > 0
    ? await notifyByMatrix(admin, {
        eventKey: 'po.vendor_needed',
        project, actorId: event.actor_id,
        title: `Assign a vendor: ${project.code}`,
        body:  `The PO is signed for ${awaitingVendor.map(i => i.type).join(', ')}. ` +
               `A vendor must be assigned before it can be ordered.`,
        link,
      })
    : await notifyByMatrix(admin, {
        eventKey: 'po.chain_complete',
        project, actorId: event.actor_id,
        title: `PO signed: ${project.code}`,
        body:  `${typeName ?? 'The type'} is fully signed and can go into production.`,
        link,
      });

  await logAudit({
    actorId: event.actor_id, action: 'automation.a4_po_chain_complete', projectId: project.id,
    resource: `system_event:${event.id}`,
    newValue: { typeName, awaitingVendor: awaitingVendor.length, notified: notified.length },
  });
}

export async function onContainerArrived(admin: any, event: SystemEvent): Promise<void> {
  const containerId = event.entity_id;
  if (!containerId) return;

  const status = typeof event.payload?.status === 'string' ? event.payload.status : 'arrived';
  const containerNo = typeof event.payload?.containerNo === 'string' ? event.payload.containerNo : null;
  const label = containerNo ? `Container ${containerNo}` : 'A container';
  const where = status === 'WAREHOUSE' ? 'reached the warehouse' : 'arrived at port';

  const { data: links, error } = await admin.from('container_items')
    .select('production_item_id').eq('container_id', containerId).limit(500) as {
      data: { production_item_id: string }[] | null; error: { message: string } | null;
    };
  if (error) { console.error('[A6] container items failed:', error.message); return; }

  const itemIds = (links ?? []).map(l => l.production_item_id);
  if (!itemIds.length) return;

  const { data: items } = await admin.from('production_items')
    .select('project_id').in('id', itemIds) as { data: { project_id: string }[] | null };

  const projectIds = [...new Set((items ?? []).map(i => i.project_id).filter(Boolean))];

  let total = 0;
  for (const pid of projectIds) {
    const project = await loadProject(admin, pid);
    if (!project) continue;
    const notified = await notifyByMatrix(admin, {
      eventKey: 'container.arrived',
      project, actorId: event.actor_id,
      title: `${label} ${where}: ${project.code}`,
      body:  `Goods for ${project.name} ${where}.`,
      link:  `/projects/${project.id}/delivery`,
    });
    total += notified.length;
  }

  await logAudit({
    actorId: event.actor_id, action: 'automation.a6_container_arrived', projectId: null,
    resource: `system_event:${event.id}`,
    newValue: { containerId, status, projects: projectIds.length, notified: total },
  });
}

export async function onChangeRequestApproved(admin: any, event: SystemEvent): Promise<void> {
  const project = await loadProject(admin, event.project_id);
  if (!project) return;

  const title = typeof event.payload?.title === 'string' ? event.payload.title : 'A change request';

  const notified = await notifyByMatrix(admin, {
    eventKey: 'change_request.approved',
    project, actorId: event.actor_id,
    title: `Change request approved: ${project.code}`,
    body:  `"${title}" was approved. Check the scope and schedule impact.`,
    link:  `/projects/${project.id}/finalization`,
  });

  await logAudit({
    actorId: event.actor_id, action: 'automation.a7_change_request_approved', projectId: project.id,
    resource: `system_event:${event.id}`, newValue: { notified: notified.length },
  });
}

export async function onApprovalReminder(admin: any, event: SystemEvent): Promise<void> {
  const project  = await loadProject(admin, event.project_id);
  const assignee = typeof event.payload?.assigneeId === 'string' ? event.payload.assigneeId : null;
  if (!assignee) return;

  const docLabel = typeof event.payload?.docLabel === 'string' ? event.payload.docLabel : 'A document';
  const days     = typeof event.payload?.waitingDays === 'number' ? event.payload.waitingDays : null;
  const where    = project ? ` on ${project.code}` : '';
  const link     = '/approvals';

  const notified = await notifyByMatrix(admin, {
    eventKey: 'approval.reminder',
    project,
    actorId: null,
    extraUserIds: [assignee],
    title: `Still waiting for your signature${where}`,
    body:  `${docLabel} has been waiting${days ? ` for ${days} days` : ''}. It needs your approval.`,
    link,
    emailSubject: `Approval still pending${where}`,
    emailHtml: (name: string) =>
      `<p>Hi ${name},</p>` +
      `<p><strong>${docLabel}</strong>${where} has been waiting${days ? ` for ${days} days` : ''} for your signature.</p>` +
      `<p><a href="${appUrl()}${link}">Review it →</a></p>`,
  });

  await logAudit({
    actorId: null, action: 'automation.a9_approval_reminder', projectId: event.project_id,
    resource: `system_event:${event.id}`,
    newValue: { assignee, days, notified: notified.length },
  });
}

let registered = false;

export function registerAllHandlers(): void {
  if (registered) return;
  registered = true;
  registerHandler('lead.closed_won',           onLeadClosedWon);
  registerHandler('handover.ready',            onHandoverReady);
  registerHandler('project.items_ready',       onProjectItemsReady);
  registerHandler('site.ready',                onSiteReady);
  registerHandler('po.chain_complete',         onPoChainComplete);
  registerHandler('container.arrived',         onContainerArrived);
  registerHandler('change_request.approved',   onChangeRequestApproved);
  registerHandler('approval.reminder',         onApprovalReminder);

}
