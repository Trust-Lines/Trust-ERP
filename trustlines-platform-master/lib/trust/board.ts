// Trust System projects on the TLines dashboard — read-only.
//
// Projects are worked by their Trust number ("490" = ClickUp's STNE490). Which board section a
// project sits in comes from its types (items), in this order — the first that matches wins:
//   Shipped                 a type has a container number and a container date today or earlier
//   To Production           a type is TO_ORDER
//   Production In Progress  a type is ORDERED (or already past it: ready, received, …)
//   Technical / PO + PF     a type has a PF code
//   Finalization            the project is in the Trust System at all
// Ready For Installation / Installation Scheduled aren't known to Trust.

export type TrustStage = 'shipped' | 'to_production' | 'in_production' | 'technical' | 'finalization';

export interface TrustItem {
  type: string | null;
  status: string | null;
  pfCode: string | null;
  containerNo: string | null;
  containerDate: string | null;
}

export interface TrustProject {
  id: string;
  projectNo: string;
  name: string;
  address: string | null;
  bucket: string;          // region code: TLINES_NE, TLINES_SE, TLINES_NW, CVW
  status: string;          // PRE_PROJECT | DONE
  types: string[] | null;
  createdAt: string;
  deletedAt: string | null;
  items: TrustItem[] | null;
}

export interface TrustBoardEntry {
  stage: TrustStage;
  note: string | null;
  onHold: boolean;
  dateISO: string;         // shipped: latest container date; else when the project was created
}

/** Production statuses at or past "ordered" (before it leaves on a container). */
const PAST_ORDERED = new Set(['ORDERED', 'BOOKS_IN_PROGRESS', 'HOLD_BOOKS', 'READY', 'READY_TO_RECEIVE', 'RECEIVED', 'SENT_TO_TLINES', 'PARTIAL_SENT', 'SENT']);
const HOLD = new Set(['HOLD_T', 'HOLD_PM']);

export function typeLabel(type: string | null): string | null {
  if (!type) return null;
  return type.toLowerCase().replace(/(^|[\s_-])\w/g, s => s.toUpperCase()).replace(/_/g, ' ');
}

/** "Image · Ready to receive", one per type (a type in several states lists each). */
export function typeStatuses(p: TrustProject): string[] {
  const byType = new Map<string, Set<string>>();
  for (const i of p.items ?? []) {
    const t = typeLabel(i.type); const s = typeLabel(i.status);
    if (!t || !s) continue;
    if (!byType.has(t)) byType.set(t, new Set());
    byType.get(t)!.add(s.charAt(0) + s.slice(1).toLowerCase());
  }
  return [...byType].map(([t, ss]) => `${t} · ${[...ss].join(', ')}`);
}

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];

/** Section, card note and date for one Trust project. `today` is yyyy-mm-dd. */
export function classifyTrustProject(p: TrustProject, today: string): TrustBoardEntry {
  const items = p.items ?? [];
  const isShipped = (i: TrustItem) => !!i.containerNo?.trim() && !!i.containerDate && i.containerDate.slice(0, 10) <= today;
  const onHold = items.some(i => !!i.status && HOLD.has(i.status));
  const created = p.createdAt.slice(0, 10);

  const shipped = items.filter(isShipped);
  if (shipped.length) {
    const notShipped = uniq(items.filter(i => !isShipped(i)).map(i => typeLabel(i.type)));
    const containers = uniq(shipped.flatMap(i => (i.containerNo ?? '').split(',').map(c => c.trim())));
    const last = shipped.map(i => i.containerDate!.slice(0, 10)).sort().at(-1)!;
    const note = [
      containers.length ? containers.map(typeLabel).join(', ') : null,
      notShipped.length ? `Not shipped: ${notShipped.join(', ')}` : 'All shipped',
    ].filter(Boolean).join(' · ');
    return { stage: 'shipped', note, onHold, dateISO: last };
  }
  if (items.some(i => i.status === 'TO_ORDER')) return { stage: 'to_production', note: null, onHold, dateISO: created };
  if (items.some(i => !!i.status && PAST_ORDERED.has(i.status))) return { stage: 'in_production', note: null, onHold, dateISO: created };
  const withPf = uniq(items.filter(i => i.pfCode?.trim()).map(i => typeLabel(i.type)));
  if (withPf.length) return { stage: 'technical', note: `PF code: ${withPf.join(', ')}`, onHold, dateISO: created };
  return { stage: 'finalization', note: null, onHold, dateISO: created };
}

const clean = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, '').trim() || undefined;

/**
 * Every live Trust project (not finished, not deleted). Never throws: when the Trust System
 * can't be read, `error` says why (missing env, HTTP status, network) so the board can show it.
 */
export async function loadTrustProjects(): Promise<{ projects: TrustProject[]; error: string | null }> {
  const raw = clean(process.env.TRUST_API_URL)?.replace(/\/+$/, '');
  const key = clean(process.env.TRUST_API_KEY) ?? clean(process.env.INTEGRATION_API_KEY);
  if (!raw || !key) return { projects: [], error: `not configured (${!raw ? 'TRUST_API_URL' : 'TRUST_API_KEY'} missing)` };
  // The API lives under /api — accept the URL with or without it.
  const base = /\/api$/.test(raw) ? raw : `${raw}/api`;
  const all: TrustProject[] = [];
  try {
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(`${base}/projects?page=${page}&limit=100`, {
        headers: { 'X-API-Key': key },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' (API key rejected)' : res.status === 404 ? ' (wrong TRUST_API_URL?)' : ''}`);
      const body = await res.json() as { data?: TrustProject[] };
      const rows = body.data ?? [];
      all.push(...rows);
      if (rows.length < 100) break;
    }
  } catch (e) {
    const msg = e instanceof Error ? (e.name === 'TimeoutError' ? 'timed out' : e.message) : String(e);
    console.error('[trust board] projects unavailable:', msg);
    return { projects: [], error: msg };
  }
  return { projects: all.filter(p => !p.deletedAt && p.status !== 'DONE'), error: null };
}
