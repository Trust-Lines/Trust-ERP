import { NextRequest, NextResponse } from 'next/server';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  let projectId: string | null = null;
  if (job!.lead_intake_id) {
    const { data: lead } = await admin.from('lead_intake').select('project_id').eq('id', job!.lead_intake_id).maybeSingle();
    projectId = (lead as { project_id?: string | null } | null)?.project_id ?? null;
  } else if (job!.opportunity_id) {
    const { data: opp } = await admin.from('opportunities').select('project_id').eq('id', job!.opportunity_id).maybeSingle();
    projectId = (opp as { project_id?: string | null } | null)?.project_id ?? null;
  }
  if (!projectId) return NextResponse.json({ error: 'This design job has no project folder yet.' }, { status: 409 });

  const { data: proj } = await admin.from('projects').select('dropbox_root_path').eq('id', projectId).maybeSingle();
  const root = (proj as { dropbox_root_path?: string } | null)?.dropbox_root_path;
  if (!root) return NextResponse.json({ error: 'Project folder not ready yet.' }, { status: 409 });

  try {
    const { createDesignFolders } = await import('@/lib/dropbox/upload');
    const res = await createDesignFolders(root);
    if (!res.designRoot) return NextResponse.json({ error: 'Could not derive the design folder path.' }, { status: 500 });
    return NextResponse.json({ designRoot: res.designRoot, created: res.created, alreadyExists: res.alreadyExists });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Dropbox error';
    console.error('[design/ensure-folder]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
