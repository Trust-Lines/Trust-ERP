import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { getDropboxClient } from '@/lib/dropbox/client';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';

type Params = { params: Promise<{ jobId: string; versionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { jobId, versionId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const { data: version } = await admin.from('sales_design_versions')
    .select('id, version_no').eq('id', versionId).eq('job_id', jobId).maybeSingle();
  if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

  let projectId: string | null = null;
  if (job!.lead_intake_id) {
    const { data: lead } = await admin.from('lead_intake').select('project_id').eq('id', job!.lead_intake_id).maybeSingle();
    projectId = (lead as { project_id?: string | null } | null)?.project_id ?? null;
  } else if (job!.opportunity_id) {
    const { data: opp } = await admin.from('opportunities').select('project_id').eq('id', job!.opportunity_id).maybeSingle();
    projectId = (opp as { project_id?: string | null } | null)?.project_id ?? null;
  }
  if (!projectId) return NextResponse.json({ error: 'This design job has no project folder yet' }, { status: 409 });

  const { data: project } = await admin.from('projects').select('dropbox_root_path').eq('id', projectId).single();
  const rootPath = (project as { dropbox_root_path?: string } | null)?.dropbox_root_path;
  if (!rootPath) return NextResponse.json({ error: 'Project folder not ready' }, { status: 409 });

  const safeName = (file.name || 'design')
    .replace(/[/\\]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .trim() || 'design';
  const path = `${rootPath}/01-Sales Design/V${version.version_no}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let dropboxPath: string;
  try {
    const res = await getDropboxClient().filesUpload({
      path,
      contents: buffer,
      mode: { '.tag': 'add' },
      autorename: true,
    });
    dropboxPath = res.result.path_lower ?? path;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Dropbox upload failed';
    console.error('[design/upload]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { data: doc, error } = await admin.from('sales_design_version_files').insert({
    version_id: versionId, job_id: jobId,
    dropbox_path: dropboxPath, file_name: safeName, uploaded_by: user.id,
  }).select('id, version_id, job_id, dropbox_path, file_name, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: user.id, action: 'design_version.file_uploaded', projectId,
    resource: `sales_design_version_files:${doc.id}`, newValue: { job: jobId, version_no: version.version_no, file_name: safeName },
  });
  return NextResponse.json({ file: doc }, { status: 201 });
}
