import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { auditFields, cleanPhoneInput } from '@/lib/it/phones';

// IT → Phone Numbers → New Number (edit.it). Secrets are encrypted before they're stored.
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const input = cleanPhoneInput(await req.json().catch(() => null), false);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const { data, error } = await ctx.admin.from('it_phone_lines').insert({ ...input.value, created_by: ctx.userId }).select('id').single();
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    return NextResponse.json({ error: missing ? 'Run migration 158_it_phone_lines.sql in Supabase first.' : 'Could not save the number' }, { status: missing ? 503 : 500 });
  }
  const id = (data as { id: string }).id;
  await logAudit({ actorId: ctx.userId, action: 'it.phone_created', resource: `it_phone:${id}`, newValue: auditFields(input.value) });
  return NextResponse.json({ line: { id } }, { status: 201 });
}
