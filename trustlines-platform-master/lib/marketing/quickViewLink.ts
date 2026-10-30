// Links that open a deal's quick view in place (Marketing → Opportunities / Marketing home), and
// which fields to point at — used by "… needs region/state" notifications instead of sending
// Marketing to the Sales CRM board (which Marketing can't open).

export type QuickViewKind = 'opportunity' | 'potential';
export const FOCUS_FIELDS = ['region', 'state', 'contact'] as const;

export interface QuickViewTarget { id: string; kind: QuickViewKind; focus: string[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function quickViewLink(kind: QuickViewKind, id: string, focus: string[] = []): string {
  const q = new URLSearchParams({ open: id, kind });
  const f = focus.filter(x => (FOCUS_FIELDS as readonly string[]).includes(x));
  if (f.length) q.set('focus', f.join(','));
  return `/marketing/opportunities?${q.toString()}`;
}

/** The target of a quickViewLink() — or of its query parameters — or null. */
export function parseQuickView(input: string | URLSearchParams | Record<string, string | undefined> | null | undefined): QuickViewTarget | null {
  if (!input) return null;
  let params: URLSearchParams;
  if (typeof input === 'string') {
    const i = input.indexOf('?');
    if (!input.startsWith('/marketing/opportunities') || i < 0) return null;
    params = new URLSearchParams(input.slice(i + 1));
  } else if (input instanceof URLSearchParams) params = input;
  else params = new URLSearchParams(Object.entries(input).filter((e): e is [string, string] => typeof e[1] === 'string'));
  const id = params.get('open') ?? '';
  const kind = params.get('kind') === 'potential' ? 'potential' : params.get('kind') === 'opportunity' ? 'opportunity' : null;
  if (!UUID.test(id) || !kind) return null;
  const focus = (params.get('focus') ?? '').split(',').filter(x => (FOCUS_FIELDS as readonly string[]).includes(x));
  return { id, kind, focus };
}

/** What a "<name> needs …" notification title asks for. */
export function focusFromMissing(text: string): string[] {
  const t = text.toLowerCase();
  return [...(/region|state/.test(t) ? ['region', 'state'] : []), ...(/contact|email|phone/.test(t) ? ['contact'] : [])];
}
