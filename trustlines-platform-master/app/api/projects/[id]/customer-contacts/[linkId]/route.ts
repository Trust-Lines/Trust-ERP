import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { PROJECT_CONTACT_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string; linkId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, linkId } = await params;
  const { user, admin, deny } = await requireRole(PROJECT_CONTACT_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('project_customer_contacts')
    .delete().eq('id', linkId).eq('project_id', id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'project_customer_contact.detached', projectId: id, resource: `project_customer_contact:${linkId}` });
  return NextResponse.json({ ok: true });
}
