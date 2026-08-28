import { NextRequest, NextResponse } from 'next/server';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';
import { designRootFromProjectRoot } from '@/lib/dropbox/paths';
import { syncDesignVersionsFromDropbox } from '@/lib/sales/designVersionSync';

type Params = { params: Promise<{ jobId: string }> };

const VER_COLS = 'id, job_id, version_no, status, preview_link, notes, presented_at, customer_feedback, created_at';

// Roadmap Month 2 — user decision (2026-08-28): "Add version" should not be a manual form. A
// designer works in the Dropbox design folder; dropping files into a "V{n}" subfolder under
// 3-Design proposal/Design Proposal IS the new version. This route is what a "Sync from Dropbox"
// button calls instead.
export async function POST(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const anchorId = job!.lead_intake_id ?? job!.opportunity_id;
  let projectId: string | null = null;
  if (job!.lead_intake_id) {
    const { data } = await admin.from('lead_intake').select('project_id').eq('id', job!.lead_intake_id).maybeSingle();
    projectId = data?.project_id ?? null;
  } else if (job!.opportunity_id) {
    const { data } = await admin.from('opportunities').select('project_id').eq('id', job!.opportunity_id).maybeSingle();
    projectId = data?.project_id ?? null;
  }
  if (!projectId) {
    return NextResponse.json({ error: 'No project yet for this job — the Dropbox design folder is not ready.', synced: false }, { status: 409 });
  }

  const { data: project } = await admin.from('projects').select('dropbox_root_path').eq('id', projectId).maybeSingle();
  const designRoot = project?.dropbox_root_path ? designRootFromProjectRoot(project.dropbox_root_path) : null;
  if (!designRoot) {
    return NextResponse.json({ error: 'Dropbox design folder path could not be resolved.', synced: false }, { status: 409 });
  }

  const result = await syncDesignVersionsFromDropbox(admin, jobId, designRoot, user.id);
  if (result.error) {
    return NextResponse.json({ error: `Dropbox sync failed: ${result.error}`, synced: false }, { status: 502 });
  }

  const { data: versions } = await admin.from('sales_design_versions').select(VER_COLS).eq('job_id', jobId).order('version_no', { ascending: false });
  const { data: jobRow } = await admin.from('sales_design_jobs').select('id, status').eq('id', jobId).maybeSingle();

  return NextResponse.json({
    synced: true, syncedVersions: result.syncedVersions, syncedFiles: result.syncedFiles,
    versions: versions ?? [], jobStatus: jobRow?.status ?? job!.status, anchorId,
  });
}
