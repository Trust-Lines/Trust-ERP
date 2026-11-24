import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { cleanSubscriptionInput, subscriptionAudit } from '@/lib/it/subscriptions';

// IT → Subscriptions → New subscription (edit.it). The password is encrypted before it's stored.
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const input = cleanSubscriptionInput(await req.json().catch(() => null), false);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const { data, error } = await ctx.admin.from('it_subscriptions').insert({ ...input.value, created_by: ctx.userId }).select('id').single();
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    return NextResponse.json({ error: missing ? 'Run migration 159_it_assignments_subscriptions.sql in Supabase first.' : 'Could not save the subscription' }, { status: missing ? 503 : 500 });
  }
  const id = (data as { id: string }).id;
  await logAudit({ actorId: ctx.userId, action: 'it.subscription_created', resource: `it_subscription:${id}`, newValue: subscriptionAudit(input.value) });
  return NextResponse.json({ subscription: { id } }, { status: 201 });
}
