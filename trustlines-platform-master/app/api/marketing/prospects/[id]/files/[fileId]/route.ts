import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_files').delete()
    .eq('id', fileId).eq('prospect_id', id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'prospect_file.deleted', resource: `prospect_files:${fileId}` });
  return NextResponse.json({ ok: true });
}
