import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { auditFields, cleanPhoneInput } from '@/lib/it/phones';

type Params = { params: Promise<{ id: string }> };

// Edit Info / retire / reactivate a phone line (edit.it). Only the fields sent change; a secret
// sent as '' is cleared, one left out is kept.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const input = cleanPhoneInput(await req.json().catch(() => null), true);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  if (!Object.keys(input.value).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { data, error } = await ctx.admin.from('it_phone_lines')
    .update({ ...input.value, updated_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not save the number' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAudit({ actorId: ctx.userId, action: 'it.phone_updated', resource: `it_phone:${id}`, newValue: auditFields(input.value) });
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
  await logAudit({ actorId: ctx.userId, action: 'it.phone_deleted', resource: `it_phone:${id}`, newValue: { number: (data as { number: string }).number } });
  return NextResponse.json({ ok: true });
}
