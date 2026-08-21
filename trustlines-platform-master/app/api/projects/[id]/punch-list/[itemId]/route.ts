import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { PUNCH_WRITE_ROLES } from '@/lib/delivery/config';

type Params = { params: Promise<{ id: string; itemId: string }> };
const COLS = 'id, project_id, title, description, status, resolved_at, created_at';

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const { user, admin, deny } = await requireRole(PUNCH_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { title?: string; description?: string; status?: string } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ('title' in body) { const t = String(body.title ?? '').trim(); if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 }); patch.title = t; }
  if ('description' in body) patch.description = body.description?.trim() || null;
  if ('status' in body) {
    if (!['open', 'done'].includes(String(body.status))) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    patch.status = body.status;
    if (body.status === 'done') { patch.resolved_at = new Date().toISOString(); patch.resolved_by = user.id; }
    else { patch.resolved_at = null; patch.resolved_by = null; }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('punch_list_items').update(patch).eq('id', itemId).eq('project_id', id).is('deleted_at', null).select(COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'punch_item.updated', projectId: id, resource: `punch_list_item:${itemId}`, newValue: patch });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const { user, admin, deny } = await requireRole(PUNCH_WRITE_ROLES);
  if (deny) return deny;
  const { data, error } = await admin.from('punch_list_items').update({ deleted_at: new Date().toISOString() }).eq('id', itemId).eq('project_id', id).is('deleted_at', null).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  await logAudit({ actorId: user.id, action: 'punch_item.deleted', projectId: id, resource: `punch_list_item:${itemId}` });
  return NextResponse.json({ ok: true });
}
