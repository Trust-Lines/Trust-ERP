import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { auditFields, cleanPhoneInput, copyAccountNumber, isMissingColumn, stampPhoneDates, writeLine } from '@/lib/it/phones';
import { checkLineItem } from '@/lib/it/phoneItemLink';
import { syncItemFromLine } from '@/lib/it/itemHolder';
import { endAssignment, recordAssignment } from '@/lib/it/assignments';

type Params = { params: Promise<{ id: string }> };

// Edit Info / retire / reactivate a phone line (edit.it). Only the fields sent change; a secret
// sent as '' is cleared, one left out is kept. A new holder or company phone is dated today and
// written to the line's assignment history; retiring the line closes its open spell.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  const input = cleanPhoneInput(body, true);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const copyError = await copyAccountNumber(ctx, body, input.value);
  if (copyError) return NextResponse.json({ error: copyError }, { status: 400 });
  if (!Object.keys(input.value).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  let prev = await ctx.admin.from('it_phone_lines').select('holder_id, holder_name, device_name').eq('id', id).is('deleted_at', null).maybeSingle();
  if (isMissingColumn(prev.error)) prev = await ctx.admin.from('it_phone_lines').select('holder_id, device_name').eq('id', id).is('deleted_at', null).maybeSingle();
  const before = prev.data as { holder_id: string | null; holder_name?: string | null; device_name: string | null } | null;
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (input.value.item_id) {
    const item = await checkLineItem(ctx, id, input.value.item_id as string);
    if ('error' in item) return NextResponse.json({ error: item.error }, { status: item.status });
    Object.assign(input.value, { device_name: item.name, personal_device: false });
  }
  const row = { ...input.value, ...stampPhoneDates(input.value, before) };

  const save = (r: Record<string, unknown>) => ctx.admin.from('it_phone_lines')
    .update({ ...r, updated_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null);
  // Before migrations 161 / 163: save the rest without their (empty) fields.
  const { error, missing } = await writeLine(save, row);
  if (error) {
    return missing
      ? NextResponse.json({ error: missing }, { status: 503 })
      : NextResponse.json({ error: 'Could not save the number' }, { status: 500 });
  }

  if (row.retired_at) await endAssignment(ctx.admin, 'phone_line', id);
  else {
    await recordAssignment(ctx.admin, {
      kind: 'phone_line', assetId: id,
      personId: ('holder_id' in row ? row.holder_id as string | null : before.holder_id) ?? null,
      personName: ('holder_name' in row ? row.holder_name as string | null : before.holder_name) ?? null,
      deviceName: ('device_name' in row ? row.device_name as string | null : before.device_name) ?? null,
      actorId: ctx.userId,
    });
    // The line's phone (a library item) gets the line's holder.
    await syncItemFromLine(ctx, id, 'holder_id' in row || 'holder_name' in row);
  }
  await logAudit({ actorId: ctx.userId, action: 'it.phone_updated', resource: `it_phone:${id}`, newValue: auditFields(row) });
  return NextResponse.json({ ok: true });
}

// Delete (soft) a phone line (edit.it).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data, error } = await ctx.admin.from('it_phone_lines')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('number').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not delete the number' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await endAssignment(ctx.admin, 'phone_line', id);
  await logAudit({ actorId: ctx.userId, action: 'it.phone_deleted', resource: `it_phone:${id}`, newValue: { number: (data as { number: string }).number } });
  return NextResponse.json({ ok: true });
}
