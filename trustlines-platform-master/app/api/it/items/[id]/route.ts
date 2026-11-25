import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { assigneeError, itApi, withHolderName, type ItemRow } from '@/lib/it/server';
import { cleanItemInput, isUuid } from '@/lib/it/validate';
import { endAssignment, recordAssignment } from '@/lib/it/assignments';
import { cleanItemPhoneNumber, itemPhoneError, syncItemPhone, unlinkItemPhone } from '@/lib/it/phoneItemLink';
import { holderOf, holds, sameHolder as isSameHolder, writeItem } from '@/lib/it/itemHolder';

async function current(admin: unknown, id: string): Promise<ItemRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await withHolderName(cols => (admin as any).from('it_items').select(cols).eq('id', id).is('deleted_at', null).maybeSingle());
  return data as ItemRow | null;
}

// Item → Edit Info (edit.it): the whole form is sent back. "Acquired at" restarts when the item
// goes to a different person; the holder is cleared when it's no longer assigned. A phone's
// `phoneNumber` links / creates / unlinks its line in Phone Numbers (left out = unchanged).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const input = cleanItemInput(body);
  if (input.value === null) return NextResponse.json({ error: input.error }, { status: 400 });
  const before = await current(ctx.admin, id);
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const bad = await assigneeError(ctx.admin, input.value);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const phone = input.value.category === 'phone' ? cleanItemPhoneNumber(body?.phoneNumber) : { value: undefined };
  if ('error' in phone) return NextResponse.json({ error: phone.error }, { status: 400 });
  const taken = await itemPhoneError(ctx, id, phone.value);
  if (taken) return NextResponse.json({ error: taken.error }, { status: taken.status });

  const now = new Date().toISOString();
  const holder = holderOf(input.value.assignee_id, input.value.holder_name);
  const had = before.status === 'assigned' ? holderOf(before.assignee_id, before.holder_name) : holderOf(null, null);
  const sameHolder = isSameHolder(had, holder);
  const assignedAt = holds(holder) ? (sameHolder ? before.assigned_at : now) : null;
  const { error, missing } = await writeItem(
    r => ctx.admin.from('it_items').update(r).eq('id', id).is('deleted_at', null),
    { ...input.value, assigned_at: assignedAt, updated_at: now },
  );
  if (missing) return NextResponse.json({ error: missing }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAssignment(ctx.admin, { kind: 'item', assetId: id, personId: holder.id, personName: holder.name, actorId: ctx.userId });
  await syncItemPhone(ctx, { id, name: input.value.name, location: input.value.location, holder, holderChanged: !sameHolder }, phone.value);

  await logAudit({
    actorId: ctx.userId, action: 'it.item_updated', resource: `it_item:${id}`,
    oldValue: { name: before.name, category: before.category, location: before.location, status: before.status, assignee_id: before.assignee_id, holder_name: before.holder_name ?? null, set_label: before.set_label, remote_address: before.remote_address },
    newValue: { ...input.value, ...(phone.value !== undefined ? { phone_number: phone.value } : {}) },
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
  await unlinkItemPhone(ctx, id);
  await logAudit({ actorId: ctx.userId, action: 'it.item_deleted', resource: `it_item:${id}`, oldValue: { name: before.name, category: before.category } });
  return NextResponse.json({ ok: true });
}
