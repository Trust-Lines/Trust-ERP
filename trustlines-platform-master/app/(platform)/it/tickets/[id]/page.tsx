import { requirePage } from '@/lib/permissions/requirePage';
import { ItTicketsClient } from '@/components/platform/it/ItTicketsClient';
import { ItTicketDetailModal } from '@/components/platform/it/ItTicketDetailModal';

// Ticket detail (Figma 828:38141 / 862:46860 / 862:47715, dark 862:48081): the tickets list with
// the ticket open as a modal on top. There is no IT tickets endpoint yet, so no request is loaded
// and the panel shows placeholders only. Pass the real records here once the source exists.
export default async function ItTicketDetailPage(_props: { params: Promise<{ id: string }> }) {
  await requirePage('page.it');

  return (
    <>
      <ItTicketsClient tickets={[]} canCreate={false} />
      <ItTicketDetailModal ticket={null} />
    </>
  );
}
