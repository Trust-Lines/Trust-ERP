import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { cleanSubscriptionInput, cleanSubscriptionUsers, saveSubscriptionUsers, subscriptionAudit } from '@/lib/it/subscriptions';

// IT → Subscriptions → New subscription (edit.it). The password is encrypted before it's stored.
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const input = cleanSubscriptionInput(body, false);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const users = body && 'users' in body ? cleanSubscriptionUsers(body.users) : null;
  if (users && 'error' in users) return NextResponse.json({ error: users.error }, { status: 400 });

  const { data, error } = await ctx.admin.from('it_subscriptions').insert({ ...input.value, created_by: ctx.userId }).select('id').single();
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    return NextResponse.json({ error: missing ? 'Run migration 159_it_assignments_subscriptions.sql in Supabase first.' : 'Could not save the subscription' }, { status: missing ? 503 : 500 });
  }
  const id = (data as { id: string }).id;
  if (users) {
    const failed = await saveSubscriptionUsers(ctx, id, users.value);
    if (failed) {
      // Don't leave a half-saved subscription behind.
      await ctx.admin.from('it_subscriptions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      return NextResponse.json({ error: failed.error }, { status: failed.status });
    }
  }
  await logAudit({ actorId: ctx.userId, action: 'it.subscription_created', resource: `it_subscription:${id}`, newValue: { ...subscriptionAudit(input.value), ...(users ? { users: users.value } : {}) } });
  return NextResponse.json({ subscription: { id } }, { status: 201 });
}
