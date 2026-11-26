// Column sorting for lists (SortHeader). Dates compare by time; a missing value always goes last,
// whichever way the column is sorted, so the rows with a date stay on top.

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> { key: K; dir: SortDir }

/** aria-sort for a column's <th>. */
export const ariaSort = <K extends string>(sort: SortState<K>, key: K): 'ascending' | 'descending' | 'none' =>
  sort.key !== key ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending';

const time = (v: string | null | undefined) => {
  const t = v ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? null : t;
};

/** Compare two ISO dates; missing / unreadable dates last. 0 when equal (let the caller break ties). */
export function compareDates(a: string | null | undefined, b: string | null | undefined, dir: SortDir): number {
  const x = time(a); const y = time(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return dir === 'asc' ? x - y : y - x;
}

/** Compare two texts (case-insensitive); empty last. */
export function compareText(a: string | null | undefined, b: string | null | undefined, dir: SortDir): number {
  const x = (a ?? '').trim(); const y = (b ?? '').trim();
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return (dir === 'asc' ? 1 : -1) * x.localeCompare(y, undefined, { sensitivity: 'base' });
}

/** Whole days from `iso` to now (0 for today / future; null without a date). */
export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  const t = time(iso);
  return t === null ? null : Math.max(0, Math.floor((now - t) / 86_400_000));
}
