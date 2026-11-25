import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { cleanSubscriptionInput, cleanSubscriptionUsers, hasBilling, isMissingColumn, saveSubscriptionUsers, subscriptionAudit, withoutBilling } from '@/lib/it/subscriptions';

type Params = { params: Promise<{ id: string }> };

// Edit / cancel / reactivate a subscription (edit.it). Only the fields sent change; a password
// sent as '' is cleared, one left out is kept.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const input = cleanSubscriptionInput(body, true);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const users = body && 'users' in body ? cleanSubscriptionUsers(body.users) : null;
  if (users && 'error' in users) return NextResponse.json({ error: users.error }, { status: 400 });
  if (!Object.keys(input.value).length && !users) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const save = (row: Record<string, unknown>) => ctx.admin.from('it_subscriptions')
    .update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id').maybeSingle();
  let { data, error } = await save(input.value);
  // Before migration 162: save the rest without the (empty) billing fields.
  if (isMissingColumn(error) && !hasBilling(input.value)) ({ data, error } = await save(withoutBilling(input.value)));
  if (error) {
    return isMissingColumn(error)
      ? NextResponse.json({ error: 'Run migration 162_it_subscription_billing.sql in Supabase first.' }, { status: 503 })
      : NextResponse.json({ error: 'Could not save the subscription' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (users) {
    const failed = await saveSubscriptionUsers(ctx, id, users.value);
    if (failed) return NextResponse.json({ error: failed.error }, { status: failed.status });
  }
  await logAudit({ actorId: ctx.userId, action: 'it.subscription_updated', resource: `it_subscription:${id}`, newValue: { ...subscriptionAudit(input.value), ...(users ? { users: users.value } : {}) } });
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
