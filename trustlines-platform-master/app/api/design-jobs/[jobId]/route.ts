import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { logLeadActivity } from '@/lib/sales/activity';
import { notifyUser, notifyLeadWatchers } from '@/lib/sales/notify';
import { deliverLeadToTrust } from '@/lib/sales/deliver';
import { requireUserWithRole, loadDesignJobWithAccess, JOB_STATUSES, DESIGN_MANAGE_ROLES } from '@/lib/sales/design';
import { syncOpportunityStageFromDesignJob } from '@/lib/marketing/design';

type Params = { params: Promise<{ jobId: string }> };

const JOB_COLS = 'id, lead_intake_id, opportunity_id, customer_id, title, brief, assigned_designer_id, status, priority, due_date, created_at, updated_at';
const EDITABLE = ['title', 'brief', 'assigned_designer_id', 'status', 'priority', 'due_date'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const canManage = DESIGN_MANAGE_ROLES.includes(role);
  const allowed = canManage ? EDITABLE : (['status'] as const);
  for (const k of Object.keys(body)) {
    if (!canManage && !(allowed as readonly string[]).includes(k)) {
      return NextResponse.json({ error: `Designers may only change status (not "${k}")` }, { status: 403 });
    }
  }

  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  if ('title' in patch) {
    const t = String(patch.title ?? '').trim();
    if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    patch.title = t;
  }
  if ('status' in patch && !(JOB_STATUSES as readonly string[]).includes(String(patch.status))) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if ('due_date' in patch) patch.due_date = patch.due_date || null;

  let newDesignerId: string | null = null;
  const isAssigning = 'assigned_designer_id' in patch;
  if (isAssigning) {
    patch.assigned_designer_id = patch.assigned_designer_id || null;
    newDesignerId = patch.assigned_designer_id as string | null;
    if (newDesignerId) {
      const { data: d } = await admin.from('profiles').select('id, full_name, role, is_active').eq('id', newDesignerId).maybeSingle();
      if (!d || !d.is_active || d.role !== 'designer') {
        return NextResponse.json({ error: 'Assignee must be an active user with the designer role' }, { status: 400 });
      }
      if (!('status' in patch) && job!.status === 'awaiting_assignment') patch.status = 'assigned';
    } else if (!('status' in patch) && job!.status === 'assigned') {
      patch.status = 'awaiting_assignment';
    }
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('sales_design_jobs').update(patch).eq('id', jobId).is('deleted_at', null).select(JOB_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Design job not found' }, { status: 404 });

  // A design job is dual-anchored since migration 079: exactly one of lead_intake_id /
  // opportunity_id is set. notifyUser/notifyLeadWatchers already accept either id — they just
  // weren't being called with opportunityId here, so an Opportunity-sourced job (the newer,
  // Marketing-driven path) silently sent NO assignment notification at all. Fixed to branch on
  // whichever anchor the job actually has.
  if (isAssigning && newDesignerId && newDesignerId !== job!.assigned_designer_id && (job!.lead_intake_id || job!.opportunity_id)) {
    if (newDesignerId !== user.id) {
      await notifyUser(admin, {
        userId: newDesignerId, leadId: job!.lead_intake_id ?? undefined, opportunityId: job!.opportunity_id ?? undefined,
        title: 'You were assigned a design job',
        body: `Design job "${data.title}" was assigned to you.`,
      });
    }
    if (job!.lead_intake_id) {
      const { data: d } = await admin.from('profiles').select('full_name').eq('id', newDesignerId).maybeSingle();
      await logLeadActivity(admin, {
        leadIntakeId: job!.lead_intake_id, actorId: user.id, kind: 'change',
        body: `design job assigned to ${(d as { full_name?: string } | null)?.full_name ?? 'a designer'}`,
      });
    }
  }

  let movedToSupply: { projectId?: string; code?: string; blocked?: boolean } | null = null;
  if (patch.status === 'approved_by_sales' && job!.status !== 'approved_by_sales' && job!.lead_intake_id) {
    await notifyLeadWatchers(admin, {
      leadId: job!.lead_intake_id, actorId: user.id,
      title: 'Design approved', body: `Design "${data.title}" was approved by Sales.`,
    });
    const deliver = await deliverLeadToTrust(admin, job!.lead_intake_id, user.id);
    if (deliver.ok) {
      movedToSupply = { projectId: deliver.projectId, code: deliver.code };
      await logLeadActivity(admin, { leadIntakeId: job!.lead_intake_id, actorId: user.id, kind: 'change', body: `design approved → moved to Supply${deliver.code ? ` as ${deliver.code}` : ''}` });
    } else if (deliver.blocked === 'BLOCK1_INCOMPLETE') {
      movedToSupply = { blocked: true };
      await notifyLeadWatchers(admin, {
        leadId: job!.lead_intake_id, actorId: user.id,
        title: 'Design approved — finish Block 1', body: 'The design is approved but the lead needs Region / Service / Address before it can move to Supply.',
      });
    }
  } else if (patch.status === 'approved_by_sales' && job!.status !== 'approved_by_sales' && job!.opportunity_id) {
    // Opportunity-path jobs already have a real project (created at Accept, C1/C2) — there is no
    // "move to Supply" delivery step to run here, only the notification.
    await notifyLeadWatchers(admin, {
      opportunityId: job!.opportunity_id, actorId: user.id,
      title: 'Design approved', body: `Design "${data.title}" was approved by Sales.`,
    });
  }

  if (patch.status === 'assigned' && job!.status !== 'assigned' && job!.opportunity_id) {
    await syncOpportunityStageFromDesignJob(admin, job!, 'discovery', 'sales_design');
  }

  await logAudit({ actorId: user.id, action: 'design_job.updated', resource: `sales_design_job:${jobId}`, newValue: patch });
  return NextResponse.json({ job: data, movedToSupply });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;
  if (!DESIGN_MANAGE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Only Sales / Ops may delete a design job' }, { status: 403 });
  }

  const { error } = await admin.from('sales_design_jobs').update({ deleted_at: new Date().toISOString() }).eq('id', jobId).is('deleted_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'design_job.deleted', resource: `sales_design_job:${jobId}` });
  return NextResponse.json({ ok: true });
}
