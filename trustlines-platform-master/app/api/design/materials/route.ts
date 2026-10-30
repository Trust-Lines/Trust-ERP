import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { NOT_READY, requireDesignPage, tableMissing } from '@/lib/design/access';
import { dropboxError, uploadLinkIn } from '@/lib/design/dropboxDirect';
import { MATERIAL_COLS, MATERIALS_ROOT, materialFields } from '@/lib/design/libraryPaths';

// Materials & Finishes catalogue. ?suppliers=1 lists suppliers for the picker.
export async function GET(req: NextRequest) {
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_materials');
  if (deny) return deny;
  if (req.nextUrl.searchParams.get('suppliers')) {
    const { data } = await admin.from('suppliers').select('id, name').eq('is_active', true).order('name').limit(1000);
    return NextResponse.json({ suppliers: data ?? [] });
  }
  const { data, error } = await admin.from('design_materials').select(MATERIAL_COLS).is('deleted_at', null).order('category').order('name').limit(3000);
  if (error) return tableMissing(error) ? NextResponse.json({ notReady: NOT_READY, materials: [] }) : NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ me: user.id, isManager, materials: data ?? [] });
}

// { action: 'upload-link', fileName } → photo upload link (/Design/Materials)
// { ...fields }                        → new material
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireDesignPage('page.design_materials');
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (body.action === 'upload-link') {
    try {
      const link = await uploadLinkIn(MATERIALS_ROOT, String(body.fileName ?? ''));
      return link ? NextResponse.json({ link }) : NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    } catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 }); }
  }

  const fields = materialFields(body, MATERIALS_ROOT);
  if ('error' in fields) return NextResponse.json({ error: fields.error }, { status: 400 });
  const { data, error } = await admin.from('design_materials').insert({ ...fields.value, created_by: user.id }).select(MATERIAL_COLS).single();
  if (error) return NextResponse.json({ error: tableMissing(error) ? NOT_READY : error.message }, { status: tableMissing(error) ? 409 : 500 });
  await logAudit({ actorId: user.id, action: 'design_material.created', resource: `design_material:${data.id}`, newValue: { name: data.name } });
  return NextResponse.json({ material: data }, { status: 201 });
}
