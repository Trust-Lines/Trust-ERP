import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { assigneeError, itApi } from '@/lib/it/server';
import { cleanItemInput } from '@/lib/it/validate';
import { recordAssignment } from '@/lib/it/assignments';
import { cleanItemPhoneNumber, itemPhoneError, syncItemPhone } from '@/lib/it/phoneItemLink';

// Items Library → Add Item (edit.it). A phone with a number gets its line in Phone Numbers
// (created, or an existing line with that number linked).
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const input = cleanItemInput(body);
  if (input.value === null) return NextResponse.json({ error: input.error }, { status: 400 });
  const bad = await assigneeError(ctx.admin, input.value);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const phone = input.value.category === 'phone' ? cleanItemPhoneNumber(body?.phoneNumber) : { value: undefined };
  if ('error' in phone) return NextResponse.json({ error: phone.error }, { status: 400 });
  const taken = await itemPhoneError(ctx, null, phone.value);
  if (taken) return NextResponse.json({ error: taken.error }, { status: taken.status });

  const now = new Date().toISOString();
  const { data, error } = await ctx.admin.from('it_items')
    .insert({ ...input.value, assigned_at: input.value.assignee_id ? now : null, created_by: ctx.userId })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const id = (data as { id: string }).id;
  await recordAssignment(ctx.admin, { kind: 'item', assetId: id, personId: input.value.assignee_id, actorId: ctx.userId });
  if (phone.value) await syncItemPhone(ctx, { id, name: input.value.name, location: input.value.location, assigneeId: input.value.assignee_id }, phone.value);

  await logAudit({ actorId: ctx.userId, action: 'it.item_created', resource: `it_item:${id}`, newValue: { ...input.value, ...(phone.value ? { phone_number: phone.value } : {}) } });
  return NextResponse.json({ item: { id } }, { status: 201 });
}
