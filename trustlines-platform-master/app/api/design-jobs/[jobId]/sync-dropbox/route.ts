import { NextRequest, NextResponse } from 'next/server';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';
import { resolveDesignFolder } from '@/lib/sales/designFolder';
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
  const folder = await resolveDesignFolder(admin, job!);
  if (!folder.ok) return NextResponse.json({ error: folder.error, synced: false }, { status: folder.status });
  const designRoot = folder.root;

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
