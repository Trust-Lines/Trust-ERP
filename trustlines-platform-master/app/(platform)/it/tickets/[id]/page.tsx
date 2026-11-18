import { notFound, redirect } from 'next/navigation';
import { ItTicketsClient } from '@/components/platform/it/ItTicketsClient';
import { ItTicketDetailModal } from '@/components/platform/it/ItTicketDetailModal';
import { itContext, loadTicketDetail, loadTickets } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';

// Ticket detail (Figma 828:38141 / 862:46860 / 862:47715, dark 862:48081): the tickets list with
// the ticket open as a modal on top. Its sender and IT can open it; IT (edit.it) closes it.
export default async function ItTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canRequest && !ctx.canManage) redirect('/dashboard');
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [{ tickets, error }, ticket] = await Promise.all([loadTickets(ctx), loadTicketDetail(ctx, id)]);
  if (!ticket && !error) notFound();

  return (
    <>
      <ItTicketsClient tickets={tickets} error={error} canCreate={ctx.canRequest} allTickets={ctx.canManage} />
      <ItTicketDetailModal ticket={ticket} canResolve={ctx.canEdit} />
    </>
  );
}
