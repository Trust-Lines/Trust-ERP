import { requirePage } from '@/lib/permissions/requirePage';
import { ItTicketDetailView } from '@/components/platform/it/ItTicketDetail';

// Ticket detail (Figma 828:38141 / 862:46860). There is no IT tickets endpoint yet, so no request is
// loaded and the layout shows placeholders only. Pass the real record here once the source exists.
export default async function ItTicketDetailPage(_props: { params: Promise<{ id: string }> }) {
  await requirePage('page.it');

  return <ItTicketDetailView ticket={null} />;
}
