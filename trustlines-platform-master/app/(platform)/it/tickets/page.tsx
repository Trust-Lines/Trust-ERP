import { requirePage } from '@/lib/permissions/requirePage';
import { ItTicketsClient } from '@/components/platform/it/ItTicketsClient';

// IT Tickets (Figma 828:37587). There is no IT tickets endpoint in the codebase yet, so the list is
// passed in empty and no sample rows are shown. Wire the real source here once it exists.
export default async function ItTicketsPage() {
  await requirePage('page.it');

  return <ItTicketsClient tickets={[]} canCreate={false} />;
}
