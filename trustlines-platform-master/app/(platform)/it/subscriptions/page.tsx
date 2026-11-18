import { requirePage } from '@/lib/permissions/requirePage';
import { ItSubscriptionsClient } from '@/components/platform/it/ItSubscriptionsClient';

// IT → Subscriptions (Figma 908:22728). There is no subscriptions data source in the codebase yet,
// so the list is passed in empty and no sample rows are shown. When it exists: load the list here
// (card last four only, no passwords), and reveal login passwords one at a time through an
// authorised, audited endpoint.
export default async function ItSubscriptionsPage() {
  await requirePage('page.it');

  return <ItSubscriptionsClient subscriptions={[]} canCreate={false} />;
}
