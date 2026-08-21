import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertPotentialAccess } from '@/lib/marketing/potentialAccess';
import { getDropboxClient } from '@/lib/dropbox/client';

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertPotentialAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: pot } = await admin.from('prospect_potentials').select('need_id').eq('id', id).maybeSingle();
  if (!pot?.need_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const [{ data: fileMatch }, { data: noteMatch }] = await Promise.all([
    admin.from('need_files').select('id').eq('need_id', pot.need_id).eq('dropbox_path', path).maybeSingle(),
    admin.from('need_notes').select('id').eq('need_id', pot.need_id).eq('image_path', path).maybeSingle(),
  ]);
  if (!fileMatch && !noteMatch) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const res = await getDropboxClient().filesGetTemporaryLink({ path });
    return NextResponse.json({ link: res.result.link });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
