// Shared bits of the T-ERP Projects board (the Trust System data, shown with T-ERP's design system).

export const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
export const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3.5';

/** Trust System row statuses, in workflow order (display values, as the API maps them). */
export const ITEM_STATUSES = [
  'NOT ORDERED', 'TO ORDER', 'HOLD BOOKS', 'BOOKS IN PROGRESS', 'ORDERED', 'WAITING PAYMENT', 'ASSEMBLY',
  'READY TO RECEIVE', 'RECEIVED', 'READY', 'SENT TO TLINES', 'PARTIAL SENT', 'SENT', 'HOLD / T', 'HOLD / PM',
];
export const PO_SIGN_STATUSES = ['NOT SIGNED', 'READY TO SIGN', 'WAITING TLINES TO SIGN', 'WAITING T TO SIGN', 'SIGNED'];
export const PF_SIGN_STATUSES = ['NOT SIGNED', 'READY TO SIGN', 'WAITING T TO SIGN', 'SIGNED WITH EST PRICE', 'SIGNED'];
/** Statuses that mean the line is finished (not counted as "open"). */
export const DONE_STATUSES = new Set(['SENT', 'SENT TO TLINES']);

/** 'HOLD / T' → 'HOLD_T', 'READY TO RECEIVE' → 'READY_TO_RECEIVE' (the API's enum). */
export function statusToEnum(display: string): string {
  return display.trim().replace(/\s*\/\s*/g, '_').replace(/\s+/g, '_');
}

/** Project number colour (Trust business rule, lib/projectColor.ts) → T-ERP status tone. */
export const PROJECT_TONE: Record<string, string> = { orange: 't8', blue: 't2', green: 't9', red: 't10' };

export const REGION_TONE: Record<string, string> = {
  'tlines-ne': 't10', 'tlines-se': 't2', 'tlines-sc': 't9', cvw: 't4', 'tlines-hq': 't0', 'tlines-tc': 't7',
};

export function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const TRY = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
export const usd = (n: number) => USD.format(n);
export const tl = (n: number) => TRY.format(n);

/** 'YYYY-MM-DD…' → local Date (date-only values must not shift a day). */
export function parseDay(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
export function toDay(d: Date | null): string | null {
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
}
export function showDay(s: string | null | undefined): string {
  const d = parseDay(s);
  return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '';
}
