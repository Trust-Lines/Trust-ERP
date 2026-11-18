'use client';

import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { ColumnResizer } from '@/components/ui/column-resize';
import { COLUMN_LABELS, type ColumnKey } from '@/lib/excel/projectsExcelExport';
import { FROZEN, HEAD_H, LABELS } from './boardStyles';
import { GAP_W, Gap, PAY_COLS, PAY_GROUPS, PROJECT_CARD, TITLE_H, edge, groupCols, startsGroup } from './payments';

/** Column widths: the board's columns, then (Payments) a gap before each card and its columns. */
export function BoardColGroup({ cols, width, payments }: { cols: ColumnKey[]; width: (c: ColumnKey) => number; payments: boolean }) {
  return (
    <colgroup>
      {cols.map(c => <col key={c} style={{ width: width(c) }} />)}
      {payments && PAY_COLS.map((c, i) => <Fragment key={c.key}>{startsGroup(i) && <col style={{ width: GAP_W }} />}<col style={{ width: c.w }} /></Fragment>)}
    </colgroup>
  );
}

/** Sticky header: (Payments) the cards' title bars, then the column headings with resize handles. */
export function BoardHead({ cols, typeLeft, payments, onResize, onFit }: {
  cols: ColumnKey[]; typeLeft: number; payments: boolean;
  onResize: (col: ColumnKey, e: React.PointerEvent) => void; onFit: (col: ColumnKey) => void;
}) {
  return (
    <thead>
      {payments && (
        <tr>
          <th colSpan={FROZEN} aria-hidden className="sticky left-0 top-0 z-40 rounded-tl-[8px] border-y border-l border-ui-divider p-0"
            style={{ height: TITLE_H, ...PROJECT_CARD.title }} />
          <th colSpan={cols.length - FROZEN} className="sticky top-0 z-30 rounded-tr-[8px] border-y border-r border-ui-divider p-2 text-center text-[20px] font-semibold"
            style={{ height: TITLE_H, ...PROJECT_CARD.title }}>
            Project
          </th>
          {PAY_GROUPS.map(g => (
            <Fragment key={g.group}>
              <Gap th />
              <th colSpan={groupCols(g.group).length} className="sticky top-0 z-20 rounded-tl-[8px] rounded-tr-[8px] border border-ui-divider p-2 text-center text-[20px] font-semibold whitespace-nowrap"
                style={{ height: TITLE_H, ...g.tone.title }}>
                {g.title}
              </th>
            </Fragment>
          ))}
        </tr>
      )}
      <tr>
        {cols.map(col => (
          <th key={col} className={cn('sticky z-20 whitespace-nowrap border-b border-r border-ui-divider px-2 text-left text-[12px] font-semibold leading-[1.4]',
            !payments && 'top-0 bg-ui-surface text-ui-body', col === 'projectNo' && 'left-0 z-30', col === 'type' && 'z-30', payments && col === 'projectNo' && 'border-l')}
            style={{ height: HEAD_H, top: payments ? TITLE_H : 0, ...(payments ? PROJECT_CARD.head : {}), ...(col === 'type' ? { left: typeLeft } : {}) }}>
            <ColumnResizer label={LABELS[col] ?? COLUMN_LABELS[col]} onResize={e => onResize(col, e)} onFit={() => onFit(col)} />
            {LABELS[col] ?? COLUMN_LABELS[col]}
          </th>
        ))}
        {payments && PAY_COLS.map((c, i) => (
          <Fragment key={c.key}>
            {startsGroup(i) && <th aria-hidden className="sticky z-20 border-0 bg-ui-page-bg p-0" style={{ top: TITLE_H }} />}
            <th className={cn('sticky z-20 whitespace-nowrap border-b border-b-ui-divider px-3 text-left text-[12px] font-semibold leading-[1.4]', edge(i))}
              style={{ top: TITLE_H, height: HEAD_H, ...PAY_GROUPS.find(g => g.group === c.group)!.tone.head }}>
              {c.label}
            </th>
          </Fragment>
        ))}
      </tr>
    </thead>
  );
}
