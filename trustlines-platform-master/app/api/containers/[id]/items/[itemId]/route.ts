import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CONTAINER_WRITE_ROLES } from '@/lib/logistics/containers';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const { user, admin, deny } = await requireRole(CONTAINER_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('container_items')
    .delete().eq('id', itemId).eq('container_id', id).select('production_item_id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  await admin.from('production_items').update({ container_no: null, container_date: null }).eq('id', data.production_item_id);

  await logAudit({ actorId: user.id, action: 'container.item_unloaded', resource: `container_item:${itemId}`, newValue: { container: id } });
  return NextResponse.json({ ok: true });
}
