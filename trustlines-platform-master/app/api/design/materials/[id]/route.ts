import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { canEditEntry, requireDesignPage } from '@/lib/design/access';
import { dropboxError, temporaryLink } from '@/lib/design/dropboxDirect';
import { MATERIAL_COLS, MATERIALS_ROOT, materialFields } from '@/lib/design/libraryPaths';

type Params = { params: Promise<{ id: string }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function load(admin: any, id: string) {
  const { data } = await admin.from('design_materials').select(MATERIAL_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  return data as { id: string; name: string; created_by: string | null; image_path: string | null } | null;
}

// { action: 'photo' } → temporary link to the material's photo
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireDesignPage('page.design_materials');
  if (deny) return deny;
  const m = await load(admin, id);
  if (!m?.image_path) return NextResponse.json({ error: 'No photo' }, { status: 404 });
  try { return NextResponse.json({ link: await temporaryLink(m.image_path) }); }
  catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 }); }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_materials');
  if (deny) return deny;
  const m = await load(admin, id);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canEditEntry(m, user.id, isManager)) return NextResponse.json({ error: 'Only whoever added it or a manager can edit this material' }, { status: 403 });
  const fields = materialFields(await req.json().catch(() => ({})), MATERIALS_ROOT, true);
  if ('error' in fields) return NextResponse.json({ error: fields.error }, { status: 400 });
  const { data, error } = await admin.from('design_materials').update({ ...fields.value, updated_at: new Date().toISOString() }).eq('id', id).select(MATERIAL_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ material: data });
}

// Soft delete — jobs that already use it keep their line (the join row stays).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_materials');
  if (deny) return deny;
  const m = await load(admin, id);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canEditEntry(m, user.id, isManager)) return NextResponse.json({ error: 'Only whoever added it or a manager can remove this material' }, { status: 403 });
  const { error } = await admin.from('design_materials').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'design_material.removed', resource: `design_material:${id}`, oldValue: { name: m.name } });
  return NextResponse.json({ ok: true });
}
