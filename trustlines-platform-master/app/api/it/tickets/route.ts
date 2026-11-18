import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi, itHandlers, notifyTicket, TICKET_COLS } from '@/lib/it/server';
import { cleanTicketInput } from '@/lib/it/validate';
import { TICKET_CATEGORY_LABEL } from '@/lib/it/constants';

// IT → Tickets: send a request to IT (page.it_requests). The sender is always the signed-in
// person. Files go up afterwards, one per request, to /api/it/tickets/<id>/files.
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('request');
  if (deny) return deny;

  const body = await req.json().catch(() => null);
  const input = cleanTicketInput(body);
  if (input.value === null) return NextResponse.json({ error: input.error }, { status: 400 });

  const { data, error } = await ctx.admin.from('it_tickets')
    .insert({ ...input.value, requester_id: ctx.userId })
    .select(TICKET_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ticket = data as { id: string; subject: string; category: keyof typeof TICKET_CATEGORY_LABEL; priority: string };

  await logAudit({ actorId: ctx.userId, action: 'it.ticket_created', resource: `it_ticket:${ticket.id}`, newValue: input.value });

  const { data: me } = await ctx.admin.from('profiles').select('full_name, email').eq('id', ctx.userId).single();
  const who = (me as { full_name: string | null; email: string | null } | null)?.full_name || 'Someone';
  await notifyTicket(ctx.admin, {
    userIds: await itHandlers(ctx.admin), actorId: ctx.userId, ticketId: ticket.id, type: 'it.ticket_created',
    title: `New IT request: ${ticket.subject}`,
    body: `${who} · ${TICKET_CATEGORY_LABEL[ticket.category]} · ${ticket.priority}`,
  });

  return NextResponse.json({ ticket: { id: ticket.id } }, { status: 201 });
}
