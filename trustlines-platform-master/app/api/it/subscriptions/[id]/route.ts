import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { cleanSubscriptionInput, subscriptionAudit } from '@/lib/it/subscriptions';

type Params = { params: Promise<{ id: string }> };

// Edit / cancel / reactivate a subscription (edit.it). Only the fields sent change; a password
// sent as '' is cleared, one left out is kept.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const input = cleanSubscriptionInput(await req.json().catch(() => null), true);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  if (!Object.keys(input.value).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { data, error } = await ctx.admin.from('it_subscriptions')
    .update({ ...input.value, updated_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not save the subscription' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAudit({ actorId: ctx.userId, action: 'it.subscription_updated', resource: `it_subscription:${id}`, newValue: subscriptionAudit(input.value) });
  return NextResponse.json({ ok: true });
}

// Delete (soft) a subscription (edit.it).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data, error } = await ctx.admin.from('it_subscriptions')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('service').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not delete the subscription' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAudit({ actorId: ctx.userId, action: 'it.subscription_deleted', resource: `it_subscription:${id}`, newValue: { service: (data as { service: string }).service } });
  return NextResponse.json({ ok: true });
}
