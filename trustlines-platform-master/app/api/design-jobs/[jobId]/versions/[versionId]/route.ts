import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { emitEvent } from '@/lib/events';
import { notifyLeadWatchers } from '@/lib/sales/notify';
import { requireUserWithRole, loadDesignJobWithAccess, VERSION_TO_JOB_STATUS } from '@/lib/sales/design';

type Params = { params: Promise<{ jobId: string; versionId: string }> };
const VER_COLS = 'id, job_id, version_no, status, preview_link, notes, presented_at, customer_feedback, created_at';
const STATUSES = ['draft', 'submitted', 'presented', 'approved', 'revision_requested', 'rejected'];

export async function PATCH(req: NextRequest, { params }: Params) {
  const { jobId, versionId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const body = await req.json().catch(() => null) as {
    status?: string; preview_link?: string | null; notes?: string; customer_feedback?: string;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ('preview_link' in body) patch.preview_link = (body.preview_link ?? '') ? String(body.preview_link).trim() : null;
  if ('notes' in body) patch.notes = (body.notes ?? '').trim() || null;
  if ('customer_feedback' in body) patch.customer_feedback = (body.customer_feedback ?? '').trim() || null;
  if ('status' in body) {
    if (!STATUSES.includes(String(body.status))) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    patch.status = body.status;
    if (body.status === 'presented') patch.presented_at = new Date().toISOString();
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('sales_design_versions').update(patch)
    .eq('id', versionId).eq('job_id', jobId).select(VER_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

  if (typeof patch.status === 'string' && VERSION_TO_JOB_STATUS[patch.status]) {
    await admin.from('sales_design_jobs').update({ status: VERSION_TO_JOB_STATUS[patch.status] }).eq('id', jobId);
  }

  if (patch.status === 'submitted' && job?.lead_intake_id) {
    await notifyLeadWatchers(admin, {
      leadId: job.lead_intake_id, actorId: user.id,
      title: 'Design ready for review', body: `V${data.version_no} is ready for Sales review.`,
    });
  }

  if (patch.status === 'submitted' || patch.status === 'revision_requested') {
    await emitEvent(admin, {
      type: patch.status === 'submitted' ? 'design.version_submitted' : 'design.revision_requested',
      entityTable: 'sales_design_versions',
      entityId: versionId,
      projectId: null,
      leadId: job?.lead_intake_id ?? null,
      actorId: user.id,
      dedupeKey: `design.${patch.status}:${versionId}:v${data.version_no}`,
      payload: { versionNo: data.version_no, jobId },
    });
  }

  await logAudit({ actorId: user.id, action: 'design_version.updated', resource: `sales_design_version:${versionId}`, newValue: patch });
  return NextResponse.json({ version: data });
}
