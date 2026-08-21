import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CONTAINER_WRITE_ROLES } from '@/lib/logistics/containers';

type Params = { params: Promise<{ id: string; docId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const { user, admin, deny } = await requireRole(CONTAINER_WRITE_ROLES);
  if (deny) return deny;

  const { error } = await admin.from('container_documents')
    .update({ deleted_at: new Date().toISOString() }).eq('id', docId).eq('container_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'container.document_removed', resource: `container:${id}` });
  return NextResponse.json({ ok: true });
}
