import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { auditFields, cleanPhoneInput, copyAccountNumber, stampPhoneDates, writeLine } from '@/lib/it/phones';
import { checkLineItem } from '@/lib/it/phoneItemLink';
import { recordAssignment } from '@/lib/it/assignments';

// IT → Phone Numbers → New Number (edit.it). Secrets are encrypted before they're stored; the
// start / holder / phone dates are today's, and the first holder opens the line's history.
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  const input = cleanPhoneInput(body, false);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const copyError = await copyAccountNumber(ctx, body, input.value);
  if (copyError) return NextResponse.json({ error: copyError }, { status: 400 });
  // A phone from the Items Library: the line's phone is that item (its name, not a personal phone).
  if (input.value.item_id) {
    const item = await checkLineItem(ctx, null, input.value.item_id as string);
    if ('error' in item) return NextResponse.json({ error: item.error }, { status: item.status });
    Object.assign(input.value, { device_name: item.name, personal_device: false });
  }
  const row = { ...input.value, ...stampPhoneDates(input.value, null) };

  // Before migrations 161 / 163: save without their (empty) fields rather than fail.
  const { data, error, missing: missingCol } = await writeLine(r => ctx.admin.from('it_phone_lines').insert({ ...r, created_by: ctx.userId }).select('id').single(), row);
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    if (missingCol) return NextResponse.json({ error: missingCol }, { status: 503 });
    return NextResponse.json({ error: missing ? 'Run migration 158_it_phone_lines.sql in Supabase first.' : 'Could not save the number' }, { status: missing ? 503 : 500 });
  }
  const id = (data as { id: string }).id;
  await recordAssignment(ctx.admin, {
    kind: 'phone_line', assetId: id, personId: (row.holder_id as string | null) ?? null, personName: (row.holder_name as string | null) ?? null,
    deviceName: (row.device_name as string | null) ?? null, actorId: ctx.userId,
  });
  await logAudit({ actorId: ctx.userId, action: 'it.phone_created', resource: `it_phone:${id}`, newValue: auditFields(row) });
  return NextResponse.json({ line: { id } }, { status: 201 });
}
