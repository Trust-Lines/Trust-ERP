import { redirect } from 'next/navigation';
import { ItTicketsClient } from '@/components/platform/it/ItTicketsClient';
import { itContext, loadTickets } from '@/lib/it/server';

// IT Tickets (Figma 828:37587). Everyone with "Send IT requests" sees and sends their own; IT
// management (page.it) sees every ticket. Data: it_tickets (migration 155) via lib/it/server.
export default async function ItTicketsPage() {
  const ctx = await itContext();
  if (!ctx) redirect('/login');
  if (!ctx.canRequest && !ctx.canManage) redirect('/dashboard');
  const { tickets, error } = await loadTickets(ctx);

  return <ItTicketsClient tickets={tickets} error={error} canCreate={ctx.canRequest} allTickets={ctx.canManage} />;
}
