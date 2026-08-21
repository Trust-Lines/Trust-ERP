import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { assertLeadAccess } from '@/lib/sales/leadAccess';
import { DESIGN_MANAGE_ROLES } from '@/lib/sales/design';

type Params = { params: Promise<{ id: string }> };

const JOB_COLS = 'id, lead_intake_id, customer_id, title, brief, assigned_designer_id, status, priority, due_date, created_at, updated_at';
const VER_COLS = 'id, job_id, version_no, status, preview_link, notes, presented_at, customer_feedback, created_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(DESIGN_MANAGE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const jobsRes = await admin.from('sales_design_jobs').select(JOB_COLS)
    .eq('lead_intake_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  if (jobsRes.error) return NextResponse.json({ jobs: [], versions: [] });
  const jobs = jobsRes.data ?? [];

  const jobIds = jobs.map((j: { id: string }) => j.id);
  let versions: unknown[] = [];
  if (jobIds.length) {
    const { data } = await admin.from('sales_design_versions').select(VER_COLS)
      .in('job_id', jobIds).order('version_no', { ascending: false });
    versions = data ?? [];
  }
  return NextResponse.json({ jobs, versions });
}
