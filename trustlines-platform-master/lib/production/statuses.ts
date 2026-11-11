// Production tracker statuses, as the Trust System Projects table has them (utils/statusStyles.ts
// there): the value stored in production_items, the label on screen, the cell fill and text colour.
// The status cells are filled with these colours across the whole cell, not shown as small chips.

export interface StatusOption { value: string; label: string; bg: string; fg: string; hint?: string }

/** STATUS, in the Trust dropdown's order. */
export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'HOLD_T',            label: 'HOLD / T',          bg: '#ffffff', fg: '#000000', hint: 'Held by Mr. T' },
  { value: 'HOLD_PM',           label: 'HOLD / PM',         bg: '#ffffff', fg: '#000000', hint: 'Held by project management' },
  { value: 'HOLD_BOOKS',        label: 'HOLD BOOKS',        bg: '#ea580c', fg: '#ffffff', hint: 'Books on hold' },
  { value: 'NOT_ORDERED',       label: 'NOT ORDERED',       bg: '#dc2626', fg: '#ffffff', hint: 'New row, not ordered yet' },
  { value: 'TO_ORDER',          label: 'TO ORDER',          bg: '#fb7185', fg: '#000000', hint: 'Being ordered' },
  { value: 'BOOKS_IN_PROGRESS', label: 'BOOKS IN PROGRESS', bg: '#0ea5e9', fg: '#ffffff', hint: 'Books are being prepared' },
  { value: 'ORDERED',           label: 'ORDERED',           bg: '#2563eb', fg: '#ffffff', hint: 'Order placed — STD set to today' },
  { value: 'WAITING_PAYMENT',   label: 'WAITING PAYMENT',   bg: '#a855f7', fg: '#ffffff', hint: 'Waiting for the payment' },
  { value: 'ASSEMBLY',          label: 'ASSEMBLY',          bg: '#fbbf24', fg: '#000000', hint: 'In assembly' },
  { value: 'READY_TO_RECEIVE',  label: 'READY TO RECEIVE',  bg: '#f97316', fg: '#ffffff', hint: 'Ready to receive — RTR' },
  { value: 'RECEIVED',          label: 'RECEIVED',          bg: '#fb923c', fg: '#000000', hint: 'Received — RTD' },
  { value: 'READY',             label: 'READY',             bg: '#86efac', fg: '#000000', hint: 'Ready — RDY' },
  { value: 'SENT_TO_TLINES',    label: 'SENT TO TLINES',    bg: '#15803d', fg: '#ffffff', hint: 'Sent to T-Lines — FTD' },
  { value: 'PARTIAL_SENT',      label: 'PARTIAL SENT',      bg: '#ffffff', fg: '#000000', hint: 'Part of it sent' },
  { value: 'SENT',              label: 'SENT',              bg: '#15803d', fg: '#ffffff', hint: 'Sent — SND' },
];

const SIGN: Record<string, StatusOption> = Object.fromEntries(([
  ['NOT_SIGNED',             'NOT SIGNED',             '#ff0000'],
  ['READY_TO_SIGN',          'READY TO SIGN',          '#ffff00'],
  ['SIGNED',                 'SIGNED',                 '#92d050'],
  ['WAITING_TLINES_TO_SIGN', 'WAITING TLINES TO SIGN', '#fb923c'],
  ['WAITING_T_TO_SIGN',      'WAITING T TO SIGN',      '#a78bfa'],
  ['SIGNED_WITH_EST_PRICE',  'SIGNED WITH EST PRICE',  '#4ade80'],
] as const).map(([value, label, bg]) => [value, { value, label, bg, fg: '#000000' }]));

/** PF SIGN STATUS (per row). */
export const PF_SIGN_OPTIONS = ['NOT_SIGNED', 'READY_TO_SIGN', 'SIGNED', 'WAITING_T_TO_SIGN', 'SIGNED_WITH_EST_PRICE'].map(v => SIGN[v]);
/** PO SIGN STATUS (one per type group). */
export const PO_SIGN_OPTIONS = ['NOT_SIGNED', 'READY_TO_SIGN', 'SIGNED', 'WAITING_TLINES_TO_SIGN', 'WAITING_T_TO_SIGN'].map(v => SIGN[v]);

/** Stored value → canonical value. Old SIGNED_NO_PRICE / SIGNED_WITH_PRICE read as SIGNED; labels are accepted too. */
export function normalizeSign(value: string | null | undefined): string {
  const v = String(value ?? '').trim().toUpperCase().replace(/[\s/()-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!v) return 'NOT_SIGNED';
  if (v === 'SIGNED_NO_PRICE' || v === 'SIGNED_WITH_PRICE') return 'SIGNED';
  return SIGN[v] ? v : 'NOT_SIGNED';
}
export const normalizeStatus = (value: string | null | undefined): string => {
  const v = String(value ?? '').trim().toUpperCase().replace(/\s*\/\s*/g, '_').replace(/[\s-]+/g, '_');
  return STATUS_OPTIONS.some(o => o.value === v) ? v : (v || 'NOT_ORDERED');
};

export const signStyle = (value: string | null | undefined): StatusOption => SIGN[normalizeSign(value)];
export const statusStyle = (value: string | null | undefined): StatusOption => {
  const v = normalizeStatus(value);
  return STATUS_OPTIONS.find(o => o.value === v) ?? { value: v, label: v.replace(/_/g, ' '), bg: '#ffffff', fg: '#000000' };
};

/**
 * The one PO value a type group shows (Trust rule): all SIGNED → SIGNED; else any WAITING TLINES
 * TO SIGN; else any WAITING T TO SIGN; else any READY TO SIGN; else NOT SIGNED.
 */
export function poRollup(values: (string | null | undefined)[]): string {
  const list = values.map(normalizeSign);
  if (list.length && list.every(v => v === 'SIGNED')) return 'SIGNED';
  for (const v of ['WAITING_TLINES_TO_SIGN', 'WAITING_T_TO_SIGN', 'READY_TO_SIGN']) if (list.includes(v)) return v;
  return 'NOT_SIGNED';
}

/** The dropdown's order: the current value first, then the rest as listed. */
export function currentFirst(options: StatusOption[], current: string): StatusOption[] {
  const cur = options.find(o => o.value === current);
  return cur ? [cur, ...options.filter(o => o !== cur)] : options;
}
