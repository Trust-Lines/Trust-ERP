'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { BOARD_CSS, toNumber, type ColumnKey, type PItem, type PProject, type PSection } from '@/lib/excel/projectsExcelExport';
import { MoneyChip } from './BoardChips';
import { FROZEN, FROZEN_TD, MONEY_COLS, TD, TYPE_TEXT, bandBg, headAddress, headName, regionTitle } from './boardStyles';
import { PAY_GROUPS, PROJECT_CARD, PayBand, PayHeadBand, PayTotalCells, payTotals } from './payments';

export type MoneyTotals = Partial<Record<ColumnKey, number>>;
/** Where the four money columns sit, so full-width rows can line their chips up under them. */
export interface MoneySpan { moneyStart: number; afterMoney: number }
export type BoardSelection = { selected: Set<string>; toggle: (id: string) => void; visible: boolean };

/** The money-column cells of a TOTAL row: blank span, one chip per money column, blank span. */
function MoneyTotalCells({ totals, span, style, cellClass, spanClass, lastClass }: {
  totals: MoneyTotals; span: MoneySpan; style: React.CSSProperties; cellClass?: string; spanClass?: string; lastClass?: string;
}) {
  return (
    <>
      <td colSpan={span.moneyStart - FROZEN} className={spanClass} style={style} />
      {MONEY_COLS.map(col => (
        <td key={col} className={cellClass} style={style}><MoneyChip col={col} value={totals[col] ?? 0} /></td>
      ))}
      <td colSpan={span.afterMoney} className={lastClass ?? spanClass} style={style} />
    </>
  );
}

/** Project # cell: a rounded box in the project's colour over all its rows, plus the Half checkbox. */
export function ProjectNoCell({ project, rowCount, barStyle, selection, onContextMenu }: {
  project: PProject; rowCount: number; barStyle: React.CSSProperties; selection?: BoardSelection;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  // "P123" shows as "123" (Trust System). Long case codes ("STRAFORD-RE-1",
  // "344-EX-1") get a smaller size so they fit the box, even on a one-row project.
  const no = String(project.projectNo).replace(/^P(?=\d+$)/, '');
  const size = no.length <= 8 ? (rowCount > 1 ? 24 : 20) : no.length <= 11 ? 15 : 12;
  return (
    <td rowSpan={rowCount} className={cn('sticky left-0 z-10 border-r border-ui-divider bg-ui-page-bg p-0', project.id && 'cursor-pointer')}
      onContextMenu={onContextMenu}>
      {/* A rounded box inside the cell: 7px page-colour margin, 12px corners. */}
      <span title={no} className="absolute inset-[7px] flex items-center justify-center overflow-hidden rounded-[12px] px-1.5 text-center font-medium leading-[1.15] [overflow-wrap:anywhere]"
        style={{ ...barStyle, fontSize: size }}>
        {no}
      </span>
      {/* Half selection: only selects, never opens the menu. */}
      {selection?.visible && project.id && (
        <Checkbox aria-label={`Select project ${project.projectNo}`} checked={selection.selected.has(project.id)}
          onCheckedChange={() => selection.toggle(project.id!)} onClick={e => e.stopPropagation()} onContextMenu={e => e.stopPropagation()}
          className="absolute left-[11px] top-[11px] z-[1]" />
      )}
    </td>
  );
}

/** Type cell over a type group's rows; opens the Edit Item panel; a red rank badge in the Groups view. */
export function TypeCell({ type, rowCount, allSent, rank, left, onOpen }: {
  type: string; rowCount: number; allSent: boolean; rank?: number; left: number;
  onOpen?: (e: React.MouseEvent) => void;
}) {
  return (
    <td rowSpan={rowCount} className={cn(TD, TYPE_TEXT, 'sticky z-10 border-r', onOpen && 'cursor-pointer hover:brightness-95')}
      onClick={onOpen} style={{ left }}>
      {/* Every row of the type SENT: the same full box as the status chips (5px margin,
          6px corners) in the Sent green (New Status 10). Otherwise plain text. */}
      {allSent ? (
        <span className="absolute inset-[5px] flex items-center justify-center overflow-hidden rounded-[6px] px-2 text-[14px] font-semibold"
          style={{ background: 'var(--status-n10-bg)', color: 'var(--status-n10-fg)' }}>
          <span className="truncate">{type}</span>
        </span>
      ) : type}
      {rank != null && (
        <span className="absolute right-1 top-1 z-[1] rounded-[3px] bg-[#dc2626] px-1 text-[10px] font-semibold leading-4 text-white" title={`Rank ${rank}`}>#{rank}</span>
      )}
    </td>
  );
}

/** A project's header band: chevron, name over address; folds the project's rows. */
export function ProjectHeadRow({ project, headKey, collapsed, barStyle, colCount, payments, onToggle, onContextMenu }: {
  project: PProject; headKey: string; collapsed: boolean; barStyle: React.CSSProperties; colCount: number; payments: boolean;
  onToggle: () => void; onContextMenu: (e: React.MouseEvent) => void;
}) {
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <tr data-project-head={headKey} onContextMenu={onContextMenu}>
      <td colSpan={FROZEN} className={cn(FROZEN_TD, 'border-y border-ui-divider p-2')} style={barStyle}>
        <button
          type="button" onClick={onToggle} aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} project ${project.projectNo}`}
          title={project.projectName || String(project.projectNo)}
          className="flex w-full min-w-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-inherit"
        >
          <Chevron size={24} aria-hidden className="shrink-0" />
          {/* Name over address, as in the design ("STNE 440" / "Cherry Hill, 1849 …"). */}
          <span className="flex min-w-0 flex-col pl-2 pr-1 leading-normal">
            <span className="truncate text-[15px] font-medium">{headName(project)}</span>
            {headAddress(project) && <span className="truncate text-[11px] font-normal">{headAddress(project)}</span>}
          </span>
        </button>
      </td>
      <td colSpan={colCount - FROZEN} className="border-y border-ui-divider" style={barStyle} />
      {payments && <PayHeadBand style={barStyle} />}
    </tr>
  );
}

/** A project's TOTAL row, full width from the left edge under the Project # box (Figma 741:16403). */
export function ProjectTotalRow({ items, totals, span, barStyle, payments }: {
  items: PItem[]; totals: MoneyTotals; span: MoneySpan; barStyle: React.CSSProperties; payments: boolean;
}) {
  return (
    <tr>
      <td colSpan={FROZEN} className={cn(FROZEN_TD, 'border-y border-ui-divider px-4 py-2.5 text-[14px] font-semibold')} style={barStyle}>TOTAL</td>
      <MoneyTotalCells totals={totals} span={span} style={barStyle} cellClass="border-y border-ui-divider px-2 py-2.5" spanClass="border-y border-ui-divider" />
      {payments && <PayTotalCells totals={payTotals(items)} styleOf={() => barStyle} />}
    </tr>
  );
}

/** A region (or PF group) band: sticks under the column header and folds the region's projects. */
export function RegionBandRow({ section, closed, top, colCount, payments, onToggle }: {
  section: PSection; closed: boolean; top: number; colCount: number; payments: boolean; onToggle: () => void;
}) {
  const background = bandBg(section);
  return (
    <tr>
      <td colSpan={FROZEN} className="sticky left-0 z-[16] overflow-hidden border-y border-ui-divider p-2 text-[#EEF2F6]"
        style={{ top, background }}>
        <button
          type="button" onClick={onToggle} aria-expanded={!closed}
          aria-label={`${closed ? 'Expand' : 'Collapse'} ${regionTitle(section.label)}`}
          className="flex w-full min-w-0 cursor-pointer items-center whitespace-nowrap border-0 bg-transparent p-0 text-left text-inherit"
        >
          {closed ? <ChevronRight size={24} aria-hidden className="shrink-0" /> : <ChevronDown size={24} aria-hidden className="shrink-0" />}
          <span className={cn('truncate pl-2 pr-1 leading-normal', section.group != null ? 'text-[22px] font-bold text-white' : 'text-[16px] font-medium')}>{regionTitle(section.label)}</span>
        </button>
      </td>
      <td colSpan={colCount - FROZEN} className="sticky z-[15] border-y border-ui-divider" style={{ top, background }} />
      {payments && <PayBand top={top} background={background} />}
    </tr>
  );
}

/** "<REGION> TOTALS": stays visible when the region is folded (board only, not Payments). */
export function SectionTotalRow({ label, totals, span }: { label: string; totals: MoneyTotals; span: MoneySpan }) {
  const style = { background: BOARD_CSS.sectionTotal.bg };
  return (
    <tr>
      <td colSpan={FROZEN} className={cn(FROZEN_TD, 'whitespace-nowrap px-4 py-2.5 text-[14px] font-semibold')} title={`${label.toUpperCase()} TOTALS`}
        style={{ background: BOARD_CSS.sectionTotal.bg, color: BOARD_CSS.sectionTotal.fg }}>
        {label.toUpperCase()} TOTALS
      </td>
      <MoneyTotalCells totals={totals} span={span} style={style} cellClass="px-2 py-2.5" />
    </tr>
  );
}

/** Payments page: "Project's Total" over every row, and the cards' grand totals beside it. */
export function GrandTotalRow({ items, span }: { items: PItem[]; span: MoneySpan }) {
  const grand: MoneyTotals = {};
  for (const it of items) for (const col of MONEY_COLS) grand[col] = (grand[col] ?? 0) + toNumber((it as Record<string, unknown>)[col] as number);
  const pink = PROJECT_CARD.head;
  return (
    <tr>
      <td colSpan={FROZEN} className={cn(FROZEN_TD, 'whitespace-nowrap border-y border-l border-ui-divider px-4 py-2.5 text-[14px] font-semibold')} style={pink}>Project&apos;s Total</td>
      <MoneyTotalCells totals={grand} span={span} style={pink} cellClass="border-y border-ui-divider px-2 py-2.5"
        spanClass="border-y border-ui-divider" lastClass="border-y border-r border-ui-divider" />
      <PayTotalCells totals={payTotals(items)} labels styleOf={g => PAY_GROUPS.find(x => x.group === g)!.tone.head} />
    </tr>
  );
}
