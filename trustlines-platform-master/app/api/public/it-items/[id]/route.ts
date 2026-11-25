import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { checkRateLimit, clientIp, hashIp } from '@/lib/security/rateLimit';
import { isUuid } from '@/lib/it/validate';
import { cleanPublicItemEdit, publicItContext } from '@/lib/it/publicItem';
import { cleanItemPhoneNumber, itemPhoneError, syncItemPhone } from '@/lib/it/phoneItemLink';
import type { ItemCategory } from '@/lib/it/constants';

// The QR label page (/item/<id>) saves what someone filled in — no account needed; the item's
// unguessable id from the label is the key. Only name, type, office, notes, specs (computers) and a
// phone's number; never the holder, status, category or remote address. Rate-limited per IP,
// audit-logged with a hashed IP.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const ipHash = await hashIp(clientIp(req.headers));
  const { allowed } = await checkRateLimit(admin, `it_item_public:${ipHash}`, 60, 3600);
  if (!allowed) return NextResponse.json({ error: 'Too many saves — try again later' }, { status: 429 });

  const { data } = await admin.from('it_items').select('id, name, category, location, status, assignee_id').eq('id', id).is('deleted_at', null).maybeSingle();
  const item = data as { id: string; name: string; category: ItemCategory; location: string | null; status: string; assignee_id: string | null } | null;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const input = cleanPublicItemEdit(body, item.category);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const phone = item.category === 'phone' ? cleanItemPhoneNumber(body?.phoneNumber) : { value: undefined };
  if ('error' in phone) return NextResponse.json({ error: phone.error }, { status: 400 });
  const ctx = publicItContext(admin);
  const taken = await itemPhoneError(ctx, id, phone.value);
  if (taken) return NextResponse.json({ error: taken.error }, { status: taken.status });

  const now = new Date().toISOString();
  const { error } = await admin.from('it_items').update({ ...input.value, updated_at: now }).eq('id', id).is('deleted_at', null);
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  const assigneeId = item.status === 'assigned' ? item.assignee_id : null;
  await syncItemPhone(ctx, { id, name: input.value.name as string, location: (input.value.location as string | null) ?? null, assigneeId }, phone.value);

  await logAudit({
    actorId: null, action: 'it.item_public_updated', resource: `it_item:${id}`,
    oldValue: { name: item.name, location: item.location },
    newValue: { ...input.value, ...(phone.value !== undefined ? { phone_number: phone.value } : {}), via: 'qr_label', ip_hash: ipHash },
  });
  return NextResponse.json({ ok: true });
}
