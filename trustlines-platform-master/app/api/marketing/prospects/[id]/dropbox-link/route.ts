import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { getDropboxClient } from '@/lib/dropbox/client';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const [{ data: fileMatch }, { data: noteMatch }] = await Promise.all([
    admin.from('prospect_files').select('id').eq('prospect_id', id).eq('dropbox_path', path).maybeSingle(),
    admin.from('prospect_contact_notes').select('id, prospect_contacts!inner(prospect_id)')
      .eq('image_path', path).eq('prospect_contacts.prospect_id', id).maybeSingle(),
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
