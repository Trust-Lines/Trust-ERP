// A company phone in the Items Library ↔ its line in Phone Numbers (it_phone_lines.item_id, migration
// 163). Saving a phone item with a number links the line with that number, or creates it — the rest
// of the line (carrier, account, SIM secrets…) is filled in on the Phone Numbers side. The line keeps
// device_name as the item's name. Service-role only, after the routes' itApi('edit') check.
import type { ItContext } from './server';
import { recordAssignment } from './assignments';

/* eslint-disable @typescript-eslint/no-explicit-any */

const LINK_MISSING = 'Run migration 163_it_phone_line_item.sql in Supabase first.';
const missingColumn = (e: { message?: string } | null | undefined) => !!e && /column|schema cache/i.test(e.message ?? '');

const digits = (n: string) => n.replace(/\D/g, '');
/** Same line: the same digits, or the same last 10 when one has a country code ("+1 475…" = "475…"). */
export function sameNumber(a: string, b: string): boolean {
  const x = digits(a); const y = digits(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.length >= 10 && y.length >= 10 && x.slice(-10) === y.slice(-10);
}

/** Body `phoneNumber` → trimmed number, null to unlink, undefined when not sent. */
export function cleanItemPhoneNumber(raw: unknown): { value: string | null | undefined } | { error: string } {
  if (raw === undefined) return { value: undefined };
  if (raw === null) return { value: null };
  if (typeof raw !== 'string') return { error: 'The phone number must be text' };
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return { value: null };
  if (t.length > 40) return { error: 'The phone number is too long' };
  if (digits(t).length < 3) return { error: 'Enter the phone number' };
  return { value: t };
}

interface LineRow { id: string; number: string; item_id: string | null; holder_id: string | null; holder_name?: string | null; location: string | null; device_name: string | null }

async function liveLines(admin: any): Promise<{ rows: LineRow[]; missing: boolean }> {
  const r = await admin.from('it_phone_lines').select('id, number, item_id, holder_id, location, device_name').is('deleted_at', null).limit(3000);
  if (missingColumn(r.error)) return { rows: [], missing: true };
  return { rows: (r.data ?? []) as LineRow[], missing: false };
}

/** Before saving the item: an error when the number is already another phone's line. */
export async function itemPhoneError(ctx: ItContext, itemId: string | null, number: string | null | undefined): Promise<{ error: string; status: number } | null> {
  if (!number) return null;
  const { rows, missing } = await liveLines(ctx.admin);
  if (missing) return { error: LINK_MISSING, status: 503 };
  const hit = rows.find(r => sameNumber(r.number, number));
  if (hit?.item_id && hit.item_id !== itemId) {
    const { data } = await ctx.admin.from('it_items').select('name').eq('id', hit.item_id).is('deleted_at', null).maybeSingle();
    if (data) return { error: `${hit.number} is already on ${(data as { name: string }).name}`, status: 409 };
  }
  return null;
}

/**
 * After saving the item. `number`: a number = link (or create) that line; null = unlink the current
 * line (it stays in Phone Numbers); undefined = keep the number, only refresh the line's phone name.
 */
export async function syncItemPhone(ctx: ItContext, item: {
  id: string; name: string; location: string | null; assigneeId: string | null;
}, number: string | null | undefined): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const linked = await ctx.admin.from('it_phone_lines').select('id, number, device_name').eq('item_id', item.id).is('deleted_at', null).maybeSingle();
  if (missingColumn(linked.error)) return;
  const current = linked.data as { id: string; number: string; device_name: string | null } | null;

  if (number === undefined || (current && number && sameNumber(current.number, number))) {
    if (current && current.device_name !== item.name) {
      await ctx.admin.from('it_phone_lines').update({ device_name: item.name, updated_at: new Date().toISOString() }).eq('id', current.id);
    }
    return;
  }
  if (current) {
    // A different number (or none): the old line no longer runs on this phone.
    await ctx.admin.from('it_phone_lines').update({ item_id: null, device_name: null, device_assigned_at: null, updated_at: new Date().toISOString() }).eq('id', current.id);
    await recordAssignment(ctx.admin, { kind: 'phone_line', assetId: current.id, personId: null, deviceName: null, actorId: ctx.userId }).catch(() => undefined);
  }
  if (!number) return;

  const { rows } = await liveLines(ctx.admin);
  const hit = rows.find(r => sameNumber(r.number, number) && (!r.item_id || r.item_id === item.id));
  if (hit) {
    const patch: Record<string, unknown> = {
      item_id: item.id, device_name: item.name, personal_device: false, updated_at: new Date().toISOString(),
      ...(hit.device_name !== item.name ? { device_assigned_at: today } : {}),
      ...(!hit.location && item.location ? { location: item.location } : {}),
      ...(!hit.holder_id && item.assigneeId ? { holder_id: item.assigneeId, holder_since: today } : {}),
    };
    await ctx.admin.from('it_phone_lines').update(patch).eq('id', hit.id);
    await recordAssignment(ctx.admin, {
      kind: 'phone_line', assetId: hit.id, personId: hit.holder_id ?? item.assigneeId, deviceName: item.name, actorId: ctx.userId,
    }).catch(() => undefined);
    return;
  }
  const { data } = await ctx.admin.from('it_phone_lines').insert({
    number, item_id: item.id, device_name: item.name, personal_device: false, device_assigned_at: today,
    location: item.location, holder_id: item.assigneeId, holder_since: item.assigneeId ? today : null,
    start_date: today, created_by: ctx.userId,
  }).select('id').single();
  const id = (data as { id: string } | null)?.id;
  if (id) await recordAssignment(ctx.admin, { kind: 'phone_line', assetId: id, personId: item.assigneeId, deviceName: item.name, actorId: ctx.userId }).catch(() => undefined);
}

/** Item deleted: its line stays in Phone Numbers without a phone. */
export async function unlinkItemPhone(ctx: ItContext, itemId: string): Promise<void> {
  await ctx.admin.from('it_phone_lines').update({ item_id: null, updated_at: new Date().toISOString() }).eq('item_id', itemId).is('deleted_at', null);
}

/** The line on one phone (item page). Null before migration 163. */
export async function loadItemPhoneLine(ctx: ItContext, itemId: string): Promise<{ id: string; number: string; carrier: string | null } | null> {
  const { data, error } = await ctx.admin.from('it_phone_lines').select('id, number, carrier').eq('item_id', itemId).is('deleted_at', null).maybeSingle();
  if (error || !data) return null;
  return data as { id: string; number: string; carrier: string | null };
}

/** Library phones the line form can pick, with the line each is on. */
export async function loadPhoneItems(ctx: ItContext): Promise<{ id: string; name: string; lineId: string | null }[]> {
  const [items, lines] = await Promise.all([
    ctx.admin.from('it_items').select('id, name').eq('category', 'phone').is('deleted_at', null).order('name').limit(1000),
    ctx.admin.from('it_phone_lines').select('id, item_id').not('item_id', 'is', null).is('deleted_at', null).limit(3000),
  ]);
  if (lines.error) return [];
  const byItem = new Map(((lines.data ?? []) as { id: string; item_id: string }[]).map(l => [l.item_id, l.id]));
  return ((items.data ?? []) as { id: string; name: string }[]).map(i => ({ id: i.id, name: i.name, lineId: byItem.get(i.id) ?? null }));
}

/** Body `itemId` on a line → the item (a live library phone not on another line), or an error. */
export async function checkLineItem(ctx: ItContext, lineId: string | null, itemId: string): Promise<{ name: string } | { error: string; status: number }> {
  const { data } = await ctx.admin.from('it_items').select('id, name, category').eq('id', itemId).is('deleted_at', null).maybeSingle();
  const item = data as { id: string; name: string; category: string } | null;
  if (!item) return { error: 'That phone is no longer in the Items Library', status: 400 };
  if (item.category !== 'phone') return { error: 'Pick an item in the Phone category', status: 400 };
  const other = await ctx.admin.from('it_phone_lines').select('id, number').eq('item_id', itemId).is('deleted_at', null).maybeSingle();
  if (missingColumn(other.error)) return { error: LINK_MISSING, status: 503 };
  const o = other.data as { id: string; number: string } | null;
  if (o && o.id !== lineId) return { error: `${item.name} already runs ${o.number}`, status: 409 };
  return { name: item.name };
}
