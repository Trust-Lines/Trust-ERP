import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';

type Params = { params: Promise<{ jobId: string }> };
const VER_COLS = 'id, job_id, version_no, status, preview_link, notes, presented_at, customer_feedback, created_at';

export async function POST(req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const b = await req.json().catch(() => ({})) as { preview_link?: string; notes?: string };

  const { data: last } = await admin.from('sales_design_versions')
    .select('version_no').eq('job_id', jobId).order('version_no', { ascending: false }).limit(1).maybeSingle();
  const nextNo = ((last as { version_no?: number } | null)?.version_no ?? 0) + 1;

  const { data, error } = await admin.from('sales_design_versions').insert({
    job_id: jobId, version_no: nextNo, status: 'draft',
    preview_link: b?.preview_link?.trim() || null, notes: b?.notes?.trim() || null, created_by: user.id,
  }).select(VER_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('sales_design_jobs').update({ status: 'working_on_it' }).eq('id', jobId).eq('status', 'assigned');

  await logAudit({ actorId: user.id, action: 'design_version.created', resource: `sales_design_version:${data.id}`, newValue: { job: jobId, version_no: nextNo } });
  return NextResponse.json({ version: data }, { status: 201 });
}
