import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi, notifyTicket, TICKET_COLS, type TicketRow } from '@/lib/it/server';
import { cleanResolution, isUuid } from '@/lib/it/validate';

// Close a ticket (edit.it): "Mark Solved" / "Mark Not solved", the note, then "Sign and Submit".
// The person who closes it is recorded; the sender is notified. A closed ticket stays closed.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const input = cleanResolution(await req.json().catch(() => null));
  if (input.value === null) return NextResponse.json({ error: input.error }, { status: 400 });

  const now = new Date().toISOString();
  const { data, error } = await ctx.admin.from('it_tickets')
    .update({ status: input.value.status, resolution_note: input.value.note, resolved_by: ctx.userId, resolved_at: now, updated_at: now })
    .eq('id', id).eq('status', 'open')
    .select(TICKET_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = data as TicketRow | null;
  if (!row) return NextResponse.json({ error: 'This ticket is already closed or no longer exists' }, { status: 409 });

  await logAudit({ actorId: ctx.userId, action: 'it.ticket_closed', resource: `it_ticket:${id}`, oldValue: { status: 'open' }, newValue: input.value });
  await notifyTicket(ctx.admin, {
    userIds: [row.requester_id], actorId: ctx.userId, ticketId: id, type: 'it.ticket_closed',
    title: input.value.status === 'solved' ? `IT request solved: ${row.subject}` : `IT request not solved: ${row.subject}`,
    body: input.value.note ?? 'Closed by IT',
  });

  return NextResponse.json({ ok: true });
}
