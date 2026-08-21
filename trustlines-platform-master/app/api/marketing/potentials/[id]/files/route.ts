import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertPotentialAccess } from '@/lib/marketing/potentialAccess';
import { getDropboxClient } from '@/lib/dropbox/client';
import { buildNeedFilesPath } from '@/lib/marketing/needFiles';
import { sanitizeFileName } from '@/lib/marketing/prospectFiles';

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

type Params = { params: Promise<{ id: string }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveNeed(admin: any, potentialId: string) {
  const { data } = await admin.from('prospect_potentials').select('need_id, title, region').eq('id', potentialId).maybeSingle();
  return data as { need_id: string | null; title: string; region: string | null } | null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertPotentialAccess(admin, id, user.id, role);
  if (denied) return denied;

  const pot = await resolveNeed(admin, id);
  if (!pot?.need_id) return NextResponse.json({ files: [] });

  const { data, error } = await admin.from('need_files')
    .select('id, need_id, dropbox_path, file_name, uploaded_by, created_at')
    .eq('need_id', pot.need_id).order('created_at', { ascending: false });
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
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertPotentialAccess(admin, id, user.id, role);
  if (denied) return denied;

  const pot = await resolveNeed(admin, id);
  if (!pot?.need_id) return NextResponse.json({ error: 'Potential has no linked Need' }, { status: 409 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const safeName = sanitizeFileName(file.name);
  const path = `${buildNeedFilesPath(pot.region, pot.title, pot.need_id)}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let dropboxPath: string;
  try {
    const res = await getDropboxClient().filesUpload({ path, contents: buffer, mode: { '.tag': 'add' }, autorename: true });
    dropboxPath = res.result.path_lower ?? path;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Dropbox upload failed';
    console.error('[potentials/files POST]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { data: fileRow, error } = await admin.from('need_files').insert({
    need_id: pot.need_id, dropbox_path: dropboxPath, file_name: safeName, uploaded_by: user.id,
  }).select('id, need_id, dropbox_path, file_name, uploaded_by, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'potential_file.uploaded', resource: `need_files:${fileRow.id}`, newValue: { potential_id: id, file_name: safeName } });
  return NextResponse.json({ file: { ...fileRow, uploaded_by_name: null } }, { status: 201 });
}
