
export function bucketFromPath(dropboxRootPath: string | null | undefined): string {
  const p = (dropboxRootPath ?? '').toUpperCase();
  if (p.includes('NE PROJECTS') || p.includes('/NE/'))   return 'TLINES_NE';
  if (p.includes('SE PROJECTS') || p.includes('/SE/'))   return 'TLINES_SE';
  if (p.includes('NW PROJECTS') || p.includes('/NW/'))   return 'TLINES_NW';
  if (p.includes('CVW'))                                  return 'CVW';
  if (p.includes('HQ'))                                   return 'TLINES_HQ';
  if (p.includes('T SHOP') || p.includes('/TC'))         return 'TLINES_TC';
  return 'OTHER';
}

export function categoryToType(category: string): string | null {
  const head = category.charAt(0).toUpperCase();
  switch (head) {
    case 'M': return 'Millwork';
    case 'S': return 'Shelving';
    case 'C': return 'Ceiling';
    case 'I': return 'Image';
    case 'F': return 'Furniture';
    case 'D': return 'Decoration';
    default:  return null;
  }
}

export function catGroupToType(catGroup: string | null | undefined): string | null {
  if (!catGroup) return null;
  const key = catGroup.trim().toLowerCase();
  const map: Record<string, string> = {
    millwork: 'Millwork', shelving: 'Shelving', ceiling: 'Ceiling',
    image: 'Image', furniture: 'Furniture', decoration: 'Decoration',
  };
  return map[key] ?? null;
}

export function typesForCategories(categories: string[] | null | undefined): string[] {
  const order = ['Millwork', 'Shelving', 'Ceiling', 'Image', 'Furniture', 'Decoration'];
  const set = new Set<string>();
  for (const c of categories ?? []) {
    const t = categoryToType(c);
    if (t) set.add(t);
  }
  return order.filter(t => set.has(t));
}

export const STATUS_CHAIN = [
  'NOT_ORDERED', 'ORDERED', 'WAITING_PAYMENT', 'READY_TO_RECEIVE',
  'RECEIVED', 'READY', 'SENT_TO_TLINES', 'PARTIAL_SENT', 'SENT',
] as const;
export type ChainStatus = typeof STATUS_CHAIN[number];

const OFF_CHAIN = new Set(['HOLD_T', 'HOLD_PM', 'ASSEMBLY']);

const STATUS_DATE: Record<string, DateField | null> = {
  NOT_ORDERED: null,
  ORDERED: 'std',
  WAITING_PAYMENT: null,
  READY_TO_RECEIVE: 'rtr',
  RECEIVED: 'rtd',
  READY: 'rdy',
  SENT_TO_TLINES: 'ftd',
  PARTIAL_SENT: null,
  SENT: 'snd',
};

export function allItemsSent(items: { status: string }[]): boolean {
  return items.length > 0 && items.every(i => i.status === 'SENT');
}

export type DateField = 'std' | 'etd' | 'rtd' | 'rtr' | 'rdy' | 'ftd' | 'snd';
export type DatePatch = Partial<Record<DateField, string | null>>;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function datesForStatusChange(
  newStatus: string,
  current: Partial<Record<DateField, string | null>>,
): DatePatch {
  if (OFF_CHAIN.has(newStatus)) return {};

  if (newStatus === 'NOT_ORDERED') {
    return { std: null, rtr: null, rtd: null, rdy: null, ftd: null, snd: null };
  }

  const targetIdx = STATUS_CHAIN.indexOf(newStatus as ChainStatus);
  if (targetIdx < 0) return {};

  const patch: DatePatch = {};
  const today = todayIso();

  for (let i = 1; i <= targetIdx; i++) {
    const field = STATUS_DATE[STATUS_CHAIN[i]];
    if (field && field !== 'etd' && !current[field]) patch[field] = today;
  }

  for (let i = targetIdx + 1; i < STATUS_CHAIN.length; i++) {
    const field = STATUS_DATE[STATUS_CHAIN[i]];
    if (field && field !== 'etd' && current[field]) patch[field] = null;
  }

  return patch;
}
