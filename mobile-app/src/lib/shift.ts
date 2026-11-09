// Mesai math on the device: the server stores raw punches (migration 144) and the status; the
// worked / break minutes per local day are summed here, in the person's own time zone.
export type PunchKind = 'in' | 'break_start' | 'break_end' | 'out';
export type ShiftStatus = 'off' | 'on' | 'break';
export interface Punch { id: string; kind: PunchKind; punched_at: string; site: string | null }
export interface ShiftData { status: ShiftStatus; last: Punch | null; punches: Punch[] }

type Span = [number, number];

/** Work and break spans from an ascending punch list; an open span runs until `now`. */
export function spans(punches: Punch[], now: number): { work: Span[]; brk: Span[] } {
  const work: Span[] = [], brk: Span[] = [];
  let w: number | null = null, b: number | null = null;
  for (const p of punches) {
    const t = Date.parse(p.punched_at);
    if (p.kind === 'in' || p.kind === 'break_end') {
      if (b !== null) brk.push([b, t]);
      b = null; w = t;
    } else if (p.kind === 'break_start') {
      if (w !== null) work.push([w, t]);
      w = null; b = t;
    } else {
      if (w !== null) work.push([w, t]);
      if (b !== null) brk.push([b, t]);
      w = null; b = null;
    }
  }
  if (w !== null) work.push([w, now]);
  if (b !== null) brk.push([b, now]);
  return { work, brk };
}

/** Milliseconds of `list` inside [from, to). */
export const within = (list: Span[], from: number, to: number) =>
  list.reduce((sum, [a, z]) => sum + Math.max(0, Math.min(z, to) - Math.max(a, from)), 0);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** "3:42" for 3 h 42 min. */
export function hm(ms: number) {
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** Self-check (runs once in dev): a shift with a break, then still on. */
if (__DEV__) {
  const at = (h: number, m = 0) => new Date(2026, 0, 5, h, m).toISOString();
  const p = (kind: PunchKind, iso: string): Punch => ({ id: iso, kind, punched_at: iso, site: null });
  const { work, brk } = spans([p('in', at(8)), p('break_start', at(12)), p('break_end', at(12, 30)), p('out', at(17))], Date.parse(at(18)));
  const day = Date.parse(at(0));
  console.assert(within(work, day, day + 864e5) === 8.5 * 36e5, 'shift: worked hours');
  console.assert(within(brk, day, day + 864e5) === 0.5 * 36e5, 'shift: break');
}
