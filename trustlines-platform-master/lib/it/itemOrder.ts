// Items Library → "My order": cards dragged into place keep their spot (it_items.position, migration
// 165). Items never placed (no position) come first, newest first, so a new item shows up on top.

export interface Orderable { id: string; addedAt: string; position: number | null }

export const MAX_ORDER_ITEMS = 2000;

export function byCustomOrder(a: Orderable, b: Orderable): number {
  if (a.position === null && b.position === null) return Date.parse(b.addedAt) - Date.parse(a.addedAt);
  if (a.position === null) return -1;
  if (b.position === null) return 1;
  return a.position - b.position || Date.parse(b.addedAt) - Date.parse(a.addedAt);
}

/** `ids` with `dragId` moved onto `targetId`'s place (before it when moving up, after it when moving down). */
export function moveId(ids: string[], dragId: string, targetId: string): string[] {
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids;
  const out = ids.slice();
  out.splice(from, 1);
  out.splice(to, 0, dragId);
  return out;
}

/** The positions to save for the order `ids`: only the items whose position changes. */
export function positionChanges(items: Orderable[], ids: string[]): { id: string; position: number }[] {
  const now = new Map(items.map(i => [i.id, i.position]));
  return ids.flatMap((id, position) => (now.get(id) === position ? [] : [{ id, position }]));
}
