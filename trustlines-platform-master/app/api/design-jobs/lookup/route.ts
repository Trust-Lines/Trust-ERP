import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';
import { assertLeadAccess } from '@/lib/sales/leadAccess';

// The CRM deal panel's "Design" card: the deal's design job at a glance — status, designer,
// latest version, the shared Dropbox folder. ?opportunityId=… or ?leadId=…
export async function GET(req: NextRequest) {
  const opportunityId = req.nextUrl.searchParams.get('opportunityId');
  const leadId = req.nextUrl.searchParams.get('leadId');
  if (!opportunityId && !leadId) return NextResponse.json({ error: 'opportunityId or leadId required' }, { status: 400 });

  const { user, role, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;
  const denied = opportunityId
    ? await assertOpportunityAccess(admin, opportunityId, user.id, role, 'read')
    : await assertLeadAccess(admin, leadId!, user.id, role);
  if (denied) return denied;

  let q = admin.from('sales_design_jobs').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(1);
  q = opportunityId ? q.eq('opportunity_id', opportunityId) : q.eq('lead_intake_id', leadId);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ job: null, notReady: true });
  const job = (rows ?? [])[0] as Record<string, unknown> | undefined;
  if (!job) return NextResponse.json({ job: null });

  const [{ data: designer }, { data: versions }] = await Promise.all([
    job.assigned_designer_id
      ? admin.from('profiles').select('full_name').eq('id', job.assigned_designer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('sales_design_versions').select('id, version_no, status, presented_at').eq('job_id', job.id).order('version_no', { ascending: false }).limit(1),
  ]);
  return NextResponse.json({
    job: {
      id: job.id, title: job.title, status: job.status, priority: job.priority, due_date: job.due_date,
      designer: (designer as { full_name?: string } | null)?.full_name ?? null,
      folder: (job.dropbox_folder_path as string | undefined) ?? null,
      sharedUrl: (job.dropbox_shared_url as string | undefined) ?? null,
      latestVersion: (versions ?? [])[0] ?? null,
    },
  });
}
