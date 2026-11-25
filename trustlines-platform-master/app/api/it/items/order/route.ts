import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { MAX_ORDER_ITEMS } from '@/lib/it/itemOrder';

// Items Library → drag a card (edit.it): saves the new places, { order: [{ id, position }] } — only
// the cards whose place changed.
export async function PATCH(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const body = await req.json().catch(() => null) as { order?: unknown } | null;
  const order = Array.isArray(body?.order) ? body.order as { id?: unknown; position?: unknown }[] : null;
  if (!order || order.length > MAX_ORDER_ITEMS) return NextResponse.json({ error: 'Send the new order' }, { status: 400 });
  const rows: { id: string; position: number }[] = [];
  for (const o of order) {
    if (!isUuid(o?.id) || !Number.isInteger(o?.position) || (o.position as number) < 0 || (o.position as number) > 100000) {
      return NextResponse.json({ error: 'Send the new order' }, { status: 400 });
    }
    rows.push({ id: o.id as string, position: o.position as number });
  }
  if (!rows.length) return NextResponse.json({ ok: true });

  for (let i = 0; i < rows.length; i += 50) {
    const results = await Promise.all(rows.slice(i, i + 50).map(r =>
      ctx.admin.from('it_items').update({ position: r.position }).eq('id', r.id).is('deleted_at', null)));
    const failed = results.find((r: { error: { message?: string } | null }) => r.error);
    if (failed?.error) {
      return /position/.test(failed.error.message ?? '')
        ? NextResponse.json({ error: 'Run migration 165_it_item_position.sql in Supabase first. Already ran it? Run NOTIFY pgrst, \'reload schema\'; in the SQL editor and try again.' }, { status: 503 })
        : NextResponse.json({ error: 'Could not save the order' }, { status: 500 });
    }
  }
  await logAudit({ actorId: ctx.userId, action: 'it.items_reordered', resource: 'it_items', newValue: { moved: rows.length } });
  return NextResponse.json({ ok: true });
}
