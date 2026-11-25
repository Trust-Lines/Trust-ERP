import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { cleanItemInput } from '@/lib/it/validate';
import { writeItem } from '@/lib/it/itemHolder';
import { auditFields, cleanPhoneInput, copyAccountNumber, stampPhoneDates, writeLine } from '@/lib/it/phones';
import { sameNumber } from '@/lib/it/phoneItemLink';
import { recordAssignment } from '@/lib/it/assignments';

// IT → Phone Numbers → Import (edit.it): phone lines and items from a JSON file IT keeps on their
// own machine (e.g. typed from the "Phones and sim cards info" sheet). Each line goes through the
// same checks as New Number — passwords, PINs and account numbers are encrypted here, never stored
// or logged in plain text. A number that is already in the list is skipped, so running the file
// twice adds nothing. Items are skipped when one with the same name and notes exists.

const MAX = 300;

export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const body = await req.json().catch(() => null) as { lines?: unknown; items?: unknown } | null;
  const lines = Array.isArray(body?.lines) ? body!.lines as Record<string, unknown>[] : [];
  const items = Array.isArray(body?.items) ? body!.items as Record<string, unknown>[] : [];
  if (!lines.length && !items.length) return NextResponse.json({ error: 'The file has no "lines" or "items"' }, { status: 400 });
  if (lines.length + items.length > MAX) return NextResponse.json({ error: `Import up to ${MAX} rows at a time` }, { status: 400 });

  const { data: live, error: liveError } = await ctx.admin.from('it_phone_lines').select('number').is('deleted_at', null).limit(5000);
  if (liveError) return NextResponse.json({ error: 'Phone numbers could not be read' }, { status: 500 });
  const numbers = ((live ?? []) as { number: string }[]).map(r => r.number);

  const created = { lines: 0, items: 0 };
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const raw of lines) {
    const label = String(raw?.number ?? '?');
    if (typeof raw?.number === 'string' && numbers.some(n => sameNumber(n, raw.number as string))) { skipped.push(`${label} (already in the list)`); continue; }
    const input = cleanPhoneInput(raw, false);
    if ('error' in input) { failed.push(`${label}: ${input.error}`); continue; }
    const copyError = await copyAccountNumber(ctx, raw, input.value);
    if (copyError) { failed.push(`${label}: ${copyError}`); continue; }
    const row = { ...input.value, ...stampPhoneDates(input.value, null) };
    const { data, error, missing } = await writeLine(r => ctx.admin.from('it_phone_lines').insert({ ...r, created_by: ctx.userId }).select('id').single(), row);
    if (error) {
      if (missing) return NextResponse.json({ error: missing, created, skipped, failed }, { status: 503 });
      failed.push(`${label}: could not save`);
      continue;
    }
    const id = (data as { id: string }).id;
    numbers.push(row.number as string);
    created.lines += 1;
    await recordAssignment(ctx.admin, {
      kind: 'phone_line', assetId: id, personId: (row.holder_id as string | null) ?? null, personName: (row.holder_name as string | null) ?? null,
      deviceName: (row.device_name as string | null) ?? null, actorId: ctx.userId,
    });
    await logAudit({ actorId: ctx.userId, action: 'it.phone_created', resource: `it_phone:${id}`, newValue: { ...auditFields(row), via: 'import' } });
  }

  for (const raw of items) {
    const input = cleanItemInput(raw);
    const label = String(raw?.name ?? '?');
    if (input.value === null) { failed.push(`${label}: ${input.error}`); continue; }
    if (input.value.status === 'assigned') { failed.push(`${label}: import items without a holder (assign them in the app)`); continue; }
    let q = ctx.admin.from('it_items').select('id').eq('name', input.value.name).is('deleted_at', null).limit(1);
    q = input.value.notes ? q.eq('notes', input.value.notes) : q.is('notes', null);
    const { data: dup } = await q;
    if ((dup ?? []).length) { skipped.push(`${label} (already in the library)`); continue; }
    const { data, error } = await writeItem(r => ctx.admin.from('it_items').insert(r).select('id').single(), { ...input.value, assigned_at: null, created_by: ctx.userId });
    if (error) { failed.push(`${label}: could not save`); continue; }
    created.items += 1;
    await logAudit({ actorId: ctx.userId, action: 'it.item_created', resource: `it_item:${(data as { id: string }).id}`, newValue: { ...input.value, via: 'import' } });
  }

  return NextResponse.json({ created, skipped, failed });
}
