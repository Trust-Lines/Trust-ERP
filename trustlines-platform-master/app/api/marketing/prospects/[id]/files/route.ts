import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { getDropboxClient } from '@/lib/dropbox/client';
import { buildProspectFilesPath, sanitizeFileName } from '@/lib/marketing/prospectFiles';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_files')
    .select('id, prospect_id, dropbox_path, file_name, uploaded_by, created_at')
    .eq('prospect_id', id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uploaderIds = [...new Set((data ?? []).map((f: { uploaded_by: string | null }) => f.uploaded_by).filter(Boolean))] as string[];
  const { data: uploaders } = uploaderIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', uploaderIds)
    : { data: [] };
  const nameById = Object.fromEntries(((uploaders ?? []) as { id: string; full_name: string }[]).map(u => [u.id, u.full_name]));

  const files = (data ?? []).map((f: { uploaded_by: string | null }) => ({ ...f, uploaded_by_name: f.uploaded_by ? (nameById[f.uploaded_by] ?? null) : null }));
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const { data: prospect } = await admin.from('prospects')
    .select('id, display_name, region').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

  const safeName = sanitizeFileName(file.name);
  const folder = buildProspectFilesPath(prospect.region, prospect.display_name, prospect.id);
  const path = `${folder}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let dropboxPath: string;
  try {
    const res = await getDropboxClient().filesUpload({
      path, contents: buffer, mode: { '.tag': 'add' }, autorename: true,
    });
    dropboxPath = res.result.path_lower ?? path;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Dropbox upload failed';
    console.error('[prospects/files POST]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { data: fileRow, error } = await admin.from('prospect_files').insert({
    prospect_id: id, dropbox_path: dropboxPath, file_name: safeName, uploaded_by: user.id,
  }).select('id, prospect_id, dropbox_path, file_name, uploaded_by, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'prospect_file.uploaded', resource: `prospect_files:${fileRow.id}`, newValue: { prospect_id: id, file_name: safeName } });
  return NextResponse.json({ file: { ...fileRow, uploaded_by_name: null } }, { status: 201 });
}
