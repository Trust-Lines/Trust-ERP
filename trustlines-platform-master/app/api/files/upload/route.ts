import { NextRequest, NextResponse } from 'next/server';
import { uploadToDropbox, ensureVersionFolder } from '@/lib/dropbox/upload';
import { createClient, requireUser } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';
import type { DocType } from '@/types/database';
import type { ProdType } from '@/lib/dropbox/paths';

export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const formData  = await request.formData();
  const file      = formData.get('file')           as File   | null;
  const projectId = formData.get('projectId')      as string | null;
  const docType   = formData.get('docType')        as string | null;
  const notes     = formData.get('notes')          as string | null;
  const stepKey   = formData.get('stepKey')        as string | null;
  const phase     = formData.get('phase')          as string | null;
  const catGroup  = formData.get('catGroup')       as string | null;

  const dropboxVersionRaw = formData.get('dropboxVersion');
  const prodTypeRaw       = formData.get('prodType')       as string | null;
  const innerVersionRaw   = formData.get('innerVersion');
  const clientApproved    = formData.get('clientApproved') === 'true';

  const dropboxVersion = dropboxVersionRaw ? Number(dropboxVersionRaw) : 1;
  const prodType       = (prodTypeRaw ?? undefined) as ProdType | undefined;
  const innerVersion   = innerVersionRaw ? Number(innerVersionRaw) : 1;

  let projectCode = formData.get('projectCode') as string | null;

  if (!file || !docType) {
    return NextResponse.json({ error: 'file and docType are required' }, { status: 400 });
  }
  if (!projectCode && !projectId) {
    return NextResponse.json({ error: 'projectId or projectCode is required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let resolvedProjectId = projectId;
  let dropboxRootPath: string | null = null;

  if (projectId) {
    const { data: proj } = await sb.from('projects').select('id, code, dropbox_root_path').eq('id', projectId).single();
    if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    projectCode     = (proj as { code: string }).code;
    dropboxRootPath = (proj as { dropbox_root_path: string | null }).dropbox_root_path;
  } else if (projectCode) {
    const { data: proj } = await sb.from('projects').select('id, dropbox_root_path').eq('code', projectCode).single();
    resolvedProjectId = proj ? (proj as { id: string }).id : null;
    dropboxRootPath   = proj ? (proj as { dropbox_root_path: string | null }).dropbox_root_path : null;
  }

  if (!dropboxRootPath) {
    return NextResponse.json({ error: 'Project has no Dropbox folder configured' }, { status: 400 });
  }

  let dbVersion = 1;
  if (resolvedProjectId) {
    const { data: maxRow } = await sb
      .from('documents')
      .select('version')
      .eq('project_id', resolvedProjectId)
      .eq('doc_type', docType)
      .order('version', { ascending: false })
      .limit(1)
      .single();
    if (maxRow) dbVersion = (maxRow as { version: number }).version + 1;
  }

  try {
    await ensureVersionFolder(dropboxRootPath, docType, dropboxVersion, prodType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[files/upload] ensureVersionFolder failed:', msg);
    return NextResponse.json({ error: `Could not create Dropbox folder: ${msg}` }, { status: 500 });
  }

  const ext = file.name.split('.').pop() ?? 'pdf';
  const ts  = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const typeLabel = docType.replace(/_/g, '-');
  const ptLabel   = prodType ? `-${prodType}` : '';
  const fileName  = `${projectCode}${ptLabel}-${typeLabel}-V${dropboxVersion}-${ts}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  let dropboxResult: { dropboxPath: string; dropboxFileId: string; dropboxRev: string };
  try {
    dropboxResult = await uploadToDropbox({
      projectRootPath: dropboxRootPath,
      docType,
      fileName,
      fileBuffer: buffer,
      version:      dropboxVersion,
      prodType,
      innerVersion,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dropbox upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const initialStatus = clientApproved ? 'approved' : 'draft';

  if (resolvedProjectId) {
    const fullPayload = {
      project_id:      resolvedProjectId,
      doc_type:        docType as DocType,
      version:         dbVersion,
      status:          initialStatus,
      dropbox_path:    dropboxResult.dropboxPath,
      dropbox_file_id: dropboxResult.dropboxFileId,
      dropbox_rev:     dropboxResult.dropboxRev,
      file_name:       fileName,
      file_size_bytes: file.size,
      mime_type:       file.type || 'application/pdf',
      uploaded_by:     user.id,
      branch:          null,
      notes:           notes ?? null,
      step_key:        stepKey ?? null,
      cat_group:       catGroup ?? prodType?.toLowerCase() ?? null,
      dropbox_version: dropboxVersion,
      prod_type:       prodType ?? null,
    };

    let uploadResult = await sb.from('documents').insert(fullPayload).select().single();

    if (uploadResult.error?.message?.includes('column') || uploadResult.error?.message?.includes('schema cache')) {
      const { step_key: _sk, cat_group: _cg, dropbox_version: _dv, prod_type: _pt, ...base } = fullPayload;
      uploadResult = await sb.from('documents').insert(base).select().single();
    }

    if (uploadResult.error) {
      return NextResponse.json({ error: (uploadResult.error as { message: string }).message }, { status: 500 });
    }

    await logAudit({ actorId: user.id, action: 'document.uploaded', projectId: projectId ?? undefined, resource: `${docType} — ${file.name}`, newValue: { docType, fileName: file.name } });
    return NextResponse.json({ success: true, document: uploadResult.data, ...dropboxResult });
  }

  return NextResponse.json({ success: true, ...dropboxResult });
}
