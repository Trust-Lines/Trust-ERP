import type { ColumnKey } from '@/lib/production/boardModel';
import { money } from './boardStyles';

// Figma's red chips are pure red with white text; everything else keeps the Excel fill.
export function Chip({ css, children }: { css: { bg: string; fg: string } | null; children: React.ReactNode }) {
  if (!children) return null;
  const red = css && ['#DC2626', '#FF0000'].includes(css.bg);
  return (
    <span
      className="inline-flex min-w-[70px] items-center justify-center whitespace-nowrap rounded-[4px] py-2 pl-2.5 pr-2 text-[12px] font-medium leading-4"
      style={{ background: red ? '#FF0000' : css?.bg ?? 'var(--status-n1-bg)', color: red ? '#FFFFFF' : css?.fg ?? 'var(--status-n1-fg)' }}
    >
      {children}
    </span>
  );
}

// No order type yet = an empty cell (was a red "-" chip), as in the Trust System.
export function OrderType({ value }: { value?: string | null }) {
  // The table grey (Figma 728:14366, New Status 01: #EBEBEB / #3D3D43, dark #3D3D43 / #DDDDDD).
  return value ? <Chip css={{ bg: 'var(--status-n1-bg)', fg: 'var(--status-n1-fg)' }}>{value}</Chip> : null;
}

export function MoneyChip({ col, value }: { col: ColumnKey; value: number }) {
  return (
    <span className="inline-flex min-w-[70px] items-center justify-center whitespace-nowrap rounded-[4px] bg-ui-page-bg py-1 pl-2.5 pr-2 text-[12px] font-medium leading-4 text-[var(--color-secondary-700)] dark:text-ui-heading">
      {money(col, value)}
    </span>
  );
}
