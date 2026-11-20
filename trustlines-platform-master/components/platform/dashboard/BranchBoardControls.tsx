'use client';

// Branch board toolbar controls: the From / To + step filter, the stages/accounts view toggle,
// the Gantt toggle, the regions/PM columns toggle, plus grouping cards into per-PM columns.

import * as React from 'react';
import { type DashboardGanttData } from './DashboardGantt';
import { CalendarDays, ChartGantt, Columns3 } from 'lucide-react';
import { Select as FilterSelect } from '@/components/ui/select';
import type { BoardCardItem, BoardColumn, BoardSection } from './BranchBoard';

/** People-filter value for cards with nobody assigned. */
export const NOBODY = '__nobody';

export const DATE_INPUT = 'h-9 w-[148px] rounded-[6px] border border-ui-divider bg-ui-input-bg py-0 pl-9 pr-2 text-[13px] font-medium text-ui-body outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring [&::-webkit-calendar-picker-indicator]:opacity-0';
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Figma "Page heading" (node 376:31511).
export type BoardView = 'stages' | 'accounts';
export const VIEW_KEY = 'tl_board_view';

export function ViewToggle({ view, onView }: { view: BoardView; onView: (v: BoardView) => void }) {
  const opt = (v: BoardView, label: string) => (
    <button
      type="button" aria-pressed={view === v} onClick={() => onView(v)}
      // Selected = solid navy with white text (dark mode: the light solid), so it reads at a glance.
      className={`h-[30px] cursor-pointer rounded-[5px] border-0 px-3 text-[13px] transition-colors ${view === v ? 'bg-[var(--ui-btn-solid)] font-semibold text-[var(--ui-btn-solid-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]' : 'bg-transparent font-medium text-ui-body hover:bg-ui-hover-bg hover:text-ui-heading'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Group cards by" className="flex h-9 items-center gap-0.5 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg p-[2px]">
      {opt('stages', 'Stages')}
      {opt('accounts', 'Accounts')}
    </div>
  );
}

/** /dashboard Gantt view: on for people who may open the installation plan (page.installation). */
export interface BoardGantt {
  /** The Gantt is showing (URL ?gantt=1). */
  active: boolean;
  /** Where the toggle goes: the Gantt view when off, the board when on. */
  href: string;
  /** Loaded by the server only while the Gantt is showing. */
  data: DashboardGanttData | null;
}

// "View as Gantt chart" — swaps the branch board for the lifecycle Gantt in place. The data is
// read on the server only while the Gantt shows, so the toggle is a navigation (?gantt=1); the
// button shows it is working and the chart area its loading rows until the server answers.
export function GanttToggle({ gantt, pending, onGo }: { gantt: BoardGantt; pending: boolean; onGo: () => void }) {
  const Icon = gantt.active ? Columns3 : ChartGantt;
  return (
    <button
      type="button" onClick={onGo} aria-pressed={gantt.active} aria-busy={pending} disabled={pending}
      className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border px-3 text-[13px] font-semibold leading-[1.4] transition-colors disabled:cursor-wait disabled:opacity-70 ${gantt.active
        ? 'border-transparent bg-[var(--ui-btn-solid)] text-[var(--ui-btn-solid-fg)]'
        : 'border-[var(--ui-input-border)] bg-ui-input-bg text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:text-ui-heading'}`}
    >
      <Icon size={16} aria-hidden />
      {gantt.active ? 'View as board' : 'View as Gantt chart'}
    </button>
  );
}

// Columns by region (the branch logos) or by T-Lines PM: one column per PM with the cards they
// look after in every region, the PM's name in the header. Remembered per browser.
// 'pms' = by T-Lines PM, 'trust_pms' = by Trust Lines PM (the card's Trust PM).
export type ColumnsBy = 'regions' | 'pms' | 'trust_pms';
export const COLUMNS_BY_KEY = 'tl_board_columns_by';
export const PM_COLORS = ['#465B6D', '#3B472B', '#2E5BA3', '#7A655E', '#5B4B8A', '#8A5A2B', '#2F6F6A', '#7A3E55'];
export const UNASSIGNED_COLOR = '#6B7280';

export function ColumnsByToggle({ by, onBy }: { by: ColumnsBy; onBy: (v: ColumnsBy) => void }) {
  const opt = (v: ColumnsBy, label: string) => (
    <button
      type="button" aria-pressed={by === v} onClick={() => onBy(v)}
      className={`h-[30px] cursor-pointer rounded-[5px] border-0 px-3 text-[13px] transition-colors ${by === v ? 'bg-[var(--ui-btn-solid)] font-semibold text-[var(--ui-btn-solid-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]' : 'bg-transparent font-medium text-ui-body hover:bg-ui-hover-bg hover:text-ui-heading'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Columns by" className="flex h-9 items-center gap-0.5 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg p-[2px]">
      {opt('regions', 'Regions')}
      {opt('pms', 'T-Lines PMs')}
      {opt('trust_pms', 'Trust Lines PMs')}
    </div>
  );
}

/** Regroup the region columns into one column per PM (T-Lines or Trust Lines; Unassigned last), keeping the stages. */
export function pmColumns(columns: BoardColumn[], pmOf: (i: BoardCardItem) => string | null, nameOf: (id: string) => string, subtitle: string): BoardColumn[] {
  const order: BoardSection[] = [];
  for (const c of columns) for (const s of c.sections) if (!order.some(o => o.key === s.key)) order.push(s);
  const byPm = new Map<string, Map<string, BoardCardItem[]>>();
  for (const c of columns) for (const s of c.sections) for (const item of s.items) {
    const pm = pmOf(item) ?? NOBODY;
    const sections = byPm.get(pm) ?? new Map<string, BoardCardItem[]>();
    sections.set(s.key, [...(sections.get(s.key) ?? []), item]);
    byPm.set(pm, sections);
  }
  const ids = [...byPm.keys()].filter(id => id !== NOBODY).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (byPm.has(NOBODY)) ids.push(NOBODY);
  return ids.map((id, i) => ({
    regionCode: `pm:${id}`,
    title: id === NOBODY ? 'Unassigned' : nameOf(id),
    name: id === NOBODY ? 'No PM' : nameOf(id),
    person: { userId: id === NOBODY ? null : id, subtitle: id === NOBODY ? 'No PM assigned' : subtitle },
    logoSrc: '', logoCode: '',
    headerColor: id === NOBODY ? UNASSIGNED_COLOR : PM_COLORS[i % PM_COLORS.length],
    sections: order.map(s => ({ ...s, items: byPm.get(id)!.get(s.key) ?? [] })),
  }));
}

/**
 * The board's From / To + step filter. No step: cards whose own date falls in the range. A step:
 * only that step, with every card that was in it on some day of the range (daily stage history,
 * lib/board/stageHistory) — a timeline of the step, not only today's cards.
 */
export function DateFilters({ from, to, stage, stageOptions, onFrom, onTo, onStage, stacked = false }: {
  from: string; to: string; stage: string;
  /** The board's steps ('' = All stages first). */
  stageOptions: { value: string; label: string }[];
  onFrom: (v: string) => void; onTo: (v: string) => void; onStage: (v: string) => void;
  /** Figma "Date range" (767:13865): the From / To labels sit above their fields. */
  stacked?: boolean;
}) {
  const labelCls = stacked
    ? 'flex flex-col gap-[5px] text-[11px] leading-[1.35] text-ui-body'
    : 'flex items-center gap-1.5 text-[11px] leading-[1.35] text-ui-body';
  return (
    <div
      className={stacked ? 'flex flex-wrap items-end gap-3' : 'flex flex-wrap items-center gap-2.5'}
      title={stage
        ? 'Cards that were in this step on any day between From and To (recorded daily from 157 on; before that, the card’s own date).'
        : 'Project cards: delivery date. Opportunity cards: date it became an opportunity (ClickUp creation date). Cards with no date are hidden while a filter is set.'}
    >
      <label className={labelCls}>
        From
        <span className="relative">
          <CalendarDays size={16} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-ui-body" />
          <input type="date" value={from} onChange={e => onFrom(e.target.value)} className={DATE_INPUT} />
        </span>
      </label>
      <label className={labelCls}>
        To
        <span className="relative">
          <CalendarDays size={16} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-ui-body" />
          <input type="date" value={to} onChange={e => onTo(e.target.value)} className={DATE_INPUT} />
        </span>
      </label>
      <FilterSelect
        aria-label="Step" value={stage} options={stageOptions} onValueChange={v => onStage(v ?? '')}
        className={`h-9 w-auto rounded-[6px] bg-ui-input-bg text-[13px] font-medium text-ui-body dark:rounded-[6px] dark:bg-ui-input-bg ${stacked ? 'border-ui-divider dark:border-ui-divider' : 'border-[var(--ui-input-border)] dark:border-[var(--ui-input-border)]'}`}
      />
    </div>
  );
}
