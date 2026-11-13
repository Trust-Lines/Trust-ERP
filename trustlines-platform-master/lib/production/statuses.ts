// Production tracker statuses: the value stored in production_items, and how its chip looks —
// Figma "Status Chip" sets for STATUS / PO SIGN / PF SIGN (TRUST-LINES ERP, nodes 722:804 light,
// 722:910 dark). Each status has a tone (globals.css --status-tN-* / --status-nN-*, which swap
// for dark mode) and an icon.

/** Icon names; StatusChip (components/platform/production/OperationalBoard.tsx) draws them. */
export type StatusIconName =
  | 'pause' | 'circle-off' | 'package' | 'loader' | 'hourglass' | 'drill'
  | 'check-check' | 'circle-check' | 'send' | 'circle-dashed-check';

export interface StatusOption {
  value: string;
  label: string;
  /** Token pair in globals.css: --status-{tone}-bg / --status-{tone}-fg. */
  tone: string;
  icon: StatusIconName;
  /** CSS colours for the chip (the tone's variables). */
  bg: string;
  fg: string;
  hint?: string;
}

const opt = (value: string, label: string, tone: string, icon: StatusIconName, hint?: string): StatusOption =>
  ({ value, label, tone, icon, bg: `var(--status-${tone}-bg)`, fg: `var(--status-${tone}-fg)`, hint });

/** STATUS, in the Trust dropdown's order. */
export const STATUS_OPTIONS: StatusOption[] = [
  opt('HOLD_T',            'Hold / T',          'n1',  'pause',               'Held by Mr. T'),
  opt('HOLD_PM',           'Hold / PM',         'n2',  'pause',               'Held by project management'),
  opt('HOLD_BOOKS',        'Hold Books',        'n3',  'pause',               'Books on hold'),
  opt('NOT_ORDERED',       'Not Ordered',       't10', 'circle-off',          'New row, not ordered yet'),
  opt('TO_ORDER',          'To Order',          'n4',  'package',             'Being ordered'),
  opt('BOOKS_IN_PROGRESS', 'Books in Progress', 't7',  'loader',              'Books are being prepared'),
  opt('ORDERED',           'Ordered',           't6',  'package',             'Order placed — STD set to today'),
  opt('WAITING_PAYMENT',   'Waiting Payment',   'n5',  'hourglass',           'Waiting for the payment'),
  opt('ASSEMBLY',          'Assembly',          't2',  'drill',               'In assembly'),
  opt('READY_TO_RECEIVE',  'Ready to Receive',  't3',  'check-check',         'Ready to receive — RTR'),
  opt('RECEIVED',          'Received',          'n6',  'check-check',         'Received — RTD'),
  opt('READY',             'Ready',             'n7',  'circle-check',        'Ready — RDY'),
  opt('SENT_TO_TLINES',    'Sent to T-Lines',   'n8',  'send',                'Sent to T-Lines — FTD'),
  opt('PARTIAL_SENT',      'Partial Sent',      'n9',  'circle-dashed-check', 'Part of it sent'),
  opt('SENT',              'Sent',              'n10', 'circle-check',        'Sent — SND'),
];

const SIGN: Record<string, StatusOption> = Object.fromEntries(([
  opt('NOT_SIGNED',             'Not Signed',              't10', 'circle-off'),
  opt('READY_TO_SIGN',          'Ready to sign',           'n7',  'circle-check'),
  opt('SIGNED',                 'Signed',                  'n10', 'circle-check'),
  opt('WAITING_TLINES_TO_SIGN', 'Waiting T Lines to sign', 'n5',  'hourglass'),
  opt('WAITING_T_TO_SIGN',      'Waiting T to sign',       't7',  'hourglass'),
  opt('SIGNED_WITH_EST_PRICE',  'Signed with EST Price',   't6',  'circle-check'),
]).map(o => [o.value, o]));

/** PF SIGN STATUS (per row). */
export const PF_SIGN_OPTIONS = ['NOT_SIGNED', 'READY_TO_SIGN', 'SIGNED', 'WAITING_T_TO_SIGN', 'SIGNED_WITH_EST_PRICE'].map(v => SIGN[v]);
/** PO SIGN STATUS (one per type group). */
export const PO_SIGN_OPTIONS = ['NOT_SIGNED', 'READY_TO_SIGN', 'SIGNED', 'WAITING_TLINES_TO_SIGN', 'WAITING_T_TO_SIGN'].map(v => SIGN[v]);

/** Stored value → canonical value. Old SIGNED_NO_PRICE / SIGNED_WITH_PRICE read as SIGNED; labels are accepted too. */
export function normalizeSign(value: string | null | undefined): string {
  const v = String(value ?? '').trim().toUpperCase().replace(/[\s/()-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!v) return 'NOT_SIGNED';
  if (v === 'SIGNED_NO_PRICE' || v === 'SIGNED_WITH_PRICE') return 'SIGNED';
  if (v === 'WAITING_T_LINES_TO_SIGN') return 'WAITING_TLINES_TO_SIGN';
  return SIGN[v] ? v : 'NOT_SIGNED';
}
export const normalizeStatus = (value: string | null | undefined): string => {
  const v = String(value ?? '').trim().toUpperCase().replace(/\s*\/\s*/g, '_').replace(/[\s-]+/g, '_');
  if (v === 'SENT_TO_T_LINES') return 'SENT_TO_TLINES';
  return STATUS_OPTIONS.some(o => o.value === v) ? v : (v || 'NOT_ORDERED');
};

export const signStyle = (value: string | null | undefined): StatusOption => SIGN[normalizeSign(value)];
export const statusStyle = (value: string | null | undefined): StatusOption => {
  const v = normalizeStatus(value);
  return STATUS_OPTIONS.find(o => o.value === v) ?? opt(v, v.replace(/_/g, ' '), 'n1', 'circle-off');
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
