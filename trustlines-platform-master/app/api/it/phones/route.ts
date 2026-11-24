import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { auditFields, cleanPhoneInput, copyAccountNumber, isMissingColumn, stampPhoneDates, withoutSheetFields } from '@/lib/it/phones';
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
  const row = { ...input.value, ...stampPhoneDates(input.value, null) };

  let { data, error } = await ctx.admin.from('it_phone_lines').insert({ ...row, created_by: ctx.userId }).select('id').single();
  // Before migration 161: save without the sheet fields rather than fail — unless they hold the user.
  if (isMissingColumn(error) && !row.holder_name) {
    ({ data, error } = await ctx.admin.from('it_phone_lines').insert({ ...withoutSheetFields(row), created_by: ctx.userId }).select('id').single());
  }
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    if (isMissingColumn(error)) return NextResponse.json({ error: 'Run migration 161_it_phone_sheet_fields.sql in Supabase first.' }, { status: 503 });
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
