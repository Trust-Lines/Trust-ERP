// Who holds an IT item: an account (assignee_id) or, for someone with no account yet, a typed name
// (holder_name, migration 164). A company phone and its line in Phone Numbers (it_phone_lines.item_id)
// share one holder: setting it on either side copies it to the other. Service-role only, after the
// routes' itApi('edit') check.
import type { ItContext } from './server';
import { withHolderName } from './server';
import { recordAssignment } from './assignments';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const ITEM_HOLDER_MIGRATION = '164_it_item_holder_name.sql';
const holderColumnMissing = (e: { message?: string } | null | undefined) => !!e && /holder_name/.test(e.message ?? '');

/**
 * An it_items insert / update. Before migration 164 an empty holder_name is left out; a typed one
 * can't be stored, so `missing` says which migration to run.
 */
type DbResult = { data: any; error: { message?: string } | null };
export async function writeItem(
  run: (row: Record<string, unknown>) => PromiseLike<DbResult>, row: Record<string, unknown>,
): Promise<DbResult & { missing: string | null }> {
  const r = await run(row);
  if (!holderColumnMissing(r.error)) return { ...r, missing: null };
  if (row.holder_name) {
    return { ...r, missing: `Run migration ${ITEM_HOLDER_MIGRATION} in Supabase first to type a holder name. Already ran it? Run NOTIFY pgrst, 'reload schema'; in the SQL editor and try again.` };
  }
  const rest = { ...row };
  delete rest.holder_name;
  return { ...(await run(rest)), missing: null };
}

export interface Holder { id: string | null; name: string | null }

/** An account wins over a typed name; blank names are nobody. */
export function holderOf(id: string | null | undefined, name: string | null | undefined): Holder {
  if (id) return { id, name: null };
  const n = (name ?? '').trim();
  return { id: null, name: n || null };
}

export const sameHolder = (a: Holder, b: Holder) => a.id === b.id && a.name === b.name;
export const holds = (h: Holder) => !!(h.id || h.name);

/**
 * The it_items fields that give an item the holder `h` (null when it already has them). Nobody makes
 * an assigned item available; an item in repair stays in repair.
 */
export function itemHolderPatch(item: { status: string; assignee_id: string | null; holder_name?: string | null }, h: Holder, now: string): Record<string, unknown> | null {
  const current = item.status === 'assigned' ? holderOf(item.assignee_id, item.holder_name) : { id: null, name: null };
  if (sameHolder(current, h)) return null;
  if (holds(h)) return { status: 'assigned', assignee_id: h.id, holder_name: h.name, assigned_at: now, updated_at: now };
  if (item.status !== 'assigned') return null;
  return { status: 'available', assignee_id: null, holder_name: null, assigned_at: null, updated_at: now };
}

/**
 * After a line is saved in Phone Numbers: its phone (if it runs on a library item) gets the line's
 * holder. `holderSent`: the save set the holder — then nobody frees the phone too; otherwise only a
 * holder is copied (linking a phone to a line with nobody on it leaves the phone as it was).
 */
export async function syncItemFromLine(ctx: ItContext, lineId: string, holderSent: boolean): Promise<void> {
  try {
    const { data: line } = await ctx.admin.from('it_phone_lines').select('item_id, holder_id, holder_name, retired_at, holder_since')
      .eq('id', lineId).is('deleted_at', null).maybeSingle();
    const l = line as { item_id: string | null; holder_id: string | null; holder_name: string | null; retired_at: string | null } | null;
    if (!l?.item_id || l.retired_at) return;
    const h = holderOf(l.holder_id, l.holder_name);
    if (!holds(h) && !holderSent) return;
    const { data: item } = await withHolderName(cols => ctx.admin.from('it_items').select(cols).eq('id', l.item_id).is('deleted_at', null).maybeSingle());
    const it = item as { id: string; status: string; assignee_id: string | null; holder_name?: string | null } | null;
    if (!it) return;
    const patch = itemHolderPatch(it, h, new Date().toISOString());
    if (!patch) return;
    const { error } = await writeItem(r => ctx.admin.from('it_items').update(r).eq('id', it.id), patch);
    if (error) return;
    await recordAssignment(ctx.admin, { kind: 'item', assetId: it.id, personId: h.id, personName: h.name, actorId: ctx.userId });
  } catch { /* the line is saved; the phone catches up on its next save */ }
}

/** The it_phone_lines fields that give a line the holder `h` (null when it already has them). */
export function lineHolderPatch(line: { holder_id: string | null; holder_name?: string | null }, h: Holder, today: string): Record<string, unknown> | null {
  if (sameHolder(holderOf(line.holder_id, line.holder_name), h)) return null;
  return { holder_id: h.id, holder_name: h.name, holder_since: holds(h) ? today : null };
}
