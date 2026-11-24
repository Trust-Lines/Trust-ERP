import { redirect } from 'next/navigation';
import { ItSubscriptionsClient } from '@/components/platform/it/ItSubscriptionsClient';
import { itContext } from '@/lib/it/server';
import { loadSubscriptions } from '@/lib/it/subscriptions';

// IT → Subscriptions (Figma 908:22728). IT management (page.it) sees the list; edit.it adds / edits /
// deletes and reveals login passwords one at a time (audited). Data: it_subscriptions (migration 159).
export default async function ItSubscriptionsPage() {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canManage) redirect('/dashboard');
  const { subscriptions, error } = await loadSubscriptions(ctx);

  return <ItSubscriptionsClient subscriptions={subscriptions} error={error} canCreate={ctx.canEdit} />;
}
