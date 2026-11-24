import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { auditFields, cleanPhoneInput, stampPhoneDates } from '@/lib/it/phones';
import { recordAssignment } from '@/lib/it/assignments';

// IT → Phone Numbers → New Number (edit.it). Secrets are encrypted before they're stored; the
// start / holder / phone dates are today's, and the first holder opens the line's history.
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const input = cleanPhoneInput(await req.json().catch(() => null), false);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const row = { ...input.value, ...stampPhoneDates(input.value, null) };

  const { data, error } = await ctx.admin.from('it_phone_lines').insert({ ...row, created_by: ctx.userId }).select('id').single();
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    return NextResponse.json({ error: missing ? 'Run migration 158_it_phone_lines.sql in Supabase first.' : 'Could not save the number' }, { status: missing ? 503 : 500 });
  }
  const id = (data as { id: string }).id;
  await recordAssignment(ctx.admin, {
    kind: 'phone_line', assetId: id, personId: (row.holder_id as string | null) ?? null,
    deviceName: (row.device_name as string | null) ?? null, actorId: ctx.userId,
  });
  await logAudit({ actorId: ctx.userId, action: 'it.phone_created', resource: `it_phone:${id}`, newValue: auditFields(row) });
  return NextResponse.json({ line: { id } }, { status: 201 });
}
