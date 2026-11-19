// Production board colours — one palette for both the Excel export (ARGB hex, no '#')
// and the on-screen board (CSS '#hex'). No exceljs here.

import { isUsdColumn, parseDate, type ColumnKey, type ProjectColor } from './boardModel';

export interface Tone { bg: string; fg: string }

/** Band colours (ARGB hex without '#'). */
export const PALETTE = {
  sectionHeader: { bg: 'B02417', fg: 'FFFFFF' },
  columnHeader:  { bg: '000000', fg: 'FFFFFF' },
  projectHeader: { bg: '404040', fg: 'FFFFFF' },
  projectTotal:  { bg: '404040', fg: 'FFFFFF' },
  sectionTotal:  { bg: '2563EB', fg: 'FFFFFF' },
  typeAllSent:   { bg: '15803D', fg: 'FFFFFF' },
} satisfies Record<string, Tone>;

export const BORDER_ARGB = 'D1D5DB';

const css = (t: Tone): Tone => ({ bg: `#${t.bg}`, fg: `#${t.fg}` });

/** Same palette as CSS colours, for the on-screen board. */
export const BOARD_CSS = {
  sectionHeader: css(PALETTE.sectionHeader),
  columnHeader:  css(PALETTE.columnHeader),
  projectHeader: css(PALETTE.projectHeader),
  projectTotal:  css(PALETTE.projectTotal),
  sectionTotal:  css(PALETTE.sectionTotal),
  typeAllSent:   css(PALETTE.typeAllSent),
  border:        `#${BORDER_ARGB}`,
};

export function projectColorArgb(color: ProjectColor): string {
  switch (color) {
    case 'orange': return 'DE8244';
    case 'blue':   return '6A99D1';
    case 'green':  return '9FCF63';
    case 'red':    return 'E53E3E';
    default:       return 'DE8244';
  }
}

/** Item status or PF sign status → cell tone. Accepts both "NOT ORDERED" and "NOT_ORDERED" spellings. */
export function statusFill(status: string | null | undefined): Tone | null {
  if (!status) return null;
  const s = status.toString().toUpperCase().trim();
  switch (s) {
    case 'NOT ORDERED': case 'NOT_ORDERED':           return { bg: 'DC2626', fg: 'FFFFFF' };
    case 'ORDERED':                                    return { bg: '2563EB', fg: 'FFFFFF' };
    case 'WAITING PAYMENT': case 'WAITING_PAYMENT':    return { bg: 'A855F7', fg: 'FFFFFF' };
    case 'ASSEMBLY':                                   return { bg: 'FBBF24', fg: '000000' };
    case 'READY TO RECEIVE': case 'READY_TO_RECEIVE':  return { bg: 'F97316', fg: 'FFFFFF' };
    case 'RECEIVED':                                   return { bg: 'FB923C', fg: '000000' };
    case 'READY':                                      return { bg: '86EFAC', fg: '000000' };
    case 'SENT TO TLINES': case 'SENT_TO_TLINES': case 'SENT': return { bg: '15803D', fg: 'FFFFFF' };
    case 'NOT SIGNED': case 'NOT_SIGNED':              return { bg: 'FF0000', fg: '000000' };
    case 'READY TO SIGN': case 'READY_TO_SIGN':        return { bg: 'FFFF00', fg: '000000' };
    case 'SIGNED':                                     return { bg: '92D050', fg: '000000' };
    default: return null;
  }
}

/** A type group's combined PO status (see groupPoSignStatus) → cell tone. */
export function signStatusFill(value: string): Tone | null {
  if (value === 'SIGNED') return { bg: '92D050', fg: '000000' };
  if (value === 'READY TO SIGN') return { bg: 'FFFF00', fg: '000000' };
  if (value === 'NOT SIGNED') return { bg: 'FF0000', fg: '000000' };
  return null;
}

export function projectColorCss(color: ProjectColor): string {
  return `#${projectColorArgb(color)}`;
}

export function statusCellCss(status: string | null | undefined): Tone | null {
  const f = statusFill(status);
  return f ? css(f) : null;
}

export function signStatusCellCss(value: string | null | undefined): Tone | null {
  const f = signStatusFill(String(value ?? '').toUpperCase());
  return f ? css(f) : null;
}

export function fmtMoneyCss(col: ColumnKey, n: number): string {
  if (n === 0) return '';
  const sym = isUsdColumn(col) ? '$' : '₺';
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDateCss(value: unknown): string {
  const d = parseDate(value);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
