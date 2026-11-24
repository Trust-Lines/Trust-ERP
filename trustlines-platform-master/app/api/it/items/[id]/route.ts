import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { assigneeError, itApi, ITEM_COLS, type ItemRow } from '@/lib/it/server';
import { cleanItemInput, isUuid } from '@/lib/it/validate';
import { endAssignment, recordAssignment } from '@/lib/it/assignments';

async function current(admin: unknown, id: string): Promise<ItemRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any).from('it_items').select(ITEM_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  return data as ItemRow | null;
}

// Item → Edit Info (edit.it): the whole form is sent back. "Acquired at" restarts when the item
// goes to a different person; the holder is cleared when it's no longer assigned.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const input = cleanItemInput(await req.json().catch(() => null));
  if (input.value === null) return NextResponse.json({ error: input.error }, { status: 400 });
  const before = await current(ctx.admin, id);
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const bad = await assigneeError(ctx.admin, input.value);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const now = new Date().toISOString();
  const sameHolder = before.status === 'assigned' && before.assignee_id === input.value.assignee_id;
  const assignedAt = input.value.assignee_id ? (sameHolder ? before.assigned_at : now) : null;
  const { error } = await ctx.admin.from('it_items')
    .update({ ...input.value, assigned_at: assignedAt, updated_at: now })
    .eq('id', id).is('deleted_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAssignment(ctx.admin, { kind: 'item', assetId: id, personId: input.value.assignee_id, actorId: ctx.userId });

  await logAudit({
    actorId: ctx.userId, action: 'it.item_updated', resource: `it_item:${id}`,
    oldValue: { name: before.name, category: before.category, location: before.location, status: before.status, assignee_id: before.assignee_id, set_label: before.set_label, remote_address: before.remote_address },
    newValue: input.value,
  });
  return NextResponse.json({ ok: true });
}

// Item → Delete (edit.it): soft delete, so the audit log and history keep pointing at it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const before = await current(ctx.admin, id);
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await ctx.admin.from('it_items').update({ deleted_at: now, updated_at: now }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await endAssignment(ctx.admin, 'item', id);
  await logAudit({ actorId: ctx.userId, action: 'it.item_deleted', resource: `it_item:${id}`, oldValue: { name: before.name, category: before.category } });
  return NextResponse.json({ ok: true });
}
