import { NextRequest, NextResponse } from 'next/server';
import { getDropboxTemporaryLink } from '@/lib/dropbox/upload';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';

type Params = { params: Promise<{ jobId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const body = await req.json().catch(() => null) as { source?: string; id?: string } | null;
  const source = body?.source;
  const id = body?.id;
  if (!id || (source !== 'intake' && source !== 'design')) {
    return NextResponse.json({ error: 'source ("intake" | "design") and id are required' }, { status: 400 });
  }

  let dropboxPath: string | null = null;

  if (source === 'intake') {
    const { data } = await admin.from('lead_intake_documents')
      .select('dropbox_path').eq('id', id).eq('lead_intake_id', job!.lead_intake_id).maybeSingle();
    dropboxPath = (data as { dropbox_path?: string } | null)?.dropbox_path ?? null;
  } else {
    const { data } = await admin.from('sales_design_version_files')
      .select('dropbox_path').eq('id', id).eq('job_id', jobId).maybeSingle();
    dropboxPath = (data as { dropbox_path?: string } | null)?.dropbox_path ?? null;
  }

  if (!dropboxPath) return NextResponse.json({ error: 'File not found for this design job' }, { status: 404 });

  try {
    const link = await getDropboxTemporaryLink(dropboxPath);
    return NextResponse.json({ link });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Dropbox link failed';
    console.error('[design/file-link]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
