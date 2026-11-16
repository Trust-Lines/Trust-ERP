'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  BRANCHES, addDays, alertOf, headcount, isClosed, monthsBetween, suggestedStatus,
  type Branch, type Clash, type Installation,
} from '@/lib/installations/compute';
import { projectNumber } from '@/lib/keyClients/match';
import { BRANCH_COLOR, HEADING, SCOPE_COLOR } from './shared';
import { ColumnsMenu } from './RegisterTab';

// Figma 651:31965 — Installation Plan → Gantt Chart: the plan's installations only (the whole
// project life is on /dashboard → "View as Gantt chart"). Left: Project #, Project/Store, Branch,
// Assigned Team, Members, Start - Finish. Right: one 300px column per month split into weeks by
// dashed lines, one bar per installation (planned start → finish) in its branch / company colour
// with its status chip at the start. Tentative = striped, overdue / double-booked = red outline,
// the accent line is today.
const MONTH_W = 300;
const ROW_H = 49;
type ColorBy = 'branch' | 'scope';

// Legend colours from the design (lighter than the bar fills so the text stays readable).
const LEGEND_COLOR: Record<Branch, string> = { NE: '#4A7599', SE: '#607D39', NW: '#2C64BE', CVW: '#A98B81' };
const NO_COLOR = '#5E6F87';

export const GANTT_COLUMNS = [
  { key: 'no', label: 'Project #', w: 129, locked: true },
  { key: 'name', label: 'Project/Store', w: 157, locked: true },
  { key: 'branch', label: 'Branch', w: 88 },
  { key: 'team', label: 'Assigned Team', w: 285 },
  { key: 'members', label: 'Members', w: 123 },
  { key: 'dates', label: 'Start - Finish', w: 142 },
] as const;
export type GanttColumn = (typeof GANTT_COLUMNS)[number]['key'];

const monthHead = (key: string) =>
  new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).toUpperCase();
/** "10 AUG" */
const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();
const daysIn = (key: string) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 0)).getUTCDate();

/** The bar's chip: the plan's status, "Overdue" when the finish date has passed. */
function chipOf(r: Installation, today: string): { label: string; red: boolean } {
  if (!isClosed(r) && !!alertOf(r, today)?.text.startsWith('Overdue')) return { label: 'Overdue', red: true };
  const s = r.status ?? suggestedStatus(r, today);
  return { label: s ?? 'No status', red: s === 'Delayed' };
}

export function GanttTab({ rows, today, clashes, projectByNo, search, dateRange, sortControl, hidden, onToggleCol, onSetAllCols }: {
  /** Already filtered (search / dates) and sorted by the page. */
  rows: Installation[];
  today: string;
  clashes: Map<string, Clash[]>;
  projectByNo: Record<string, string>;
  /** The page's own toolbar controls, placed where the design puts them. */
  search: React.ReactNode;
  dateRange: React.ReactNode;
  sortControl: React.ReactNode;
  hidden: Set<GanttColumn>;
  onToggleCol: (k: GanttColumn) => void;
  onSetAllCols: (show: boolean) => void;
}) {
  const [colorBy, setColorBy] = React.useState<ColorBy>('branch');
  const cols = GANTT_COLUMNS.filter(c => !hidden.has(c.key));
  const leftW = cols.reduce((n, c) => n + c.w, 0);

  // Months: every month a shown bar touches (always including today's), at least six wide.
  const months = React.useMemo(() => {
    const ds = rows.flatMap(r => [r.planned_start, r.planned_finish]).filter((d): d is string => !!d).sort();
    const lo = [ds[0], today].filter(Boolean).sort()[0]!;
    let hi = [ds.at(-1), today].filter((d): d is string => !!d).sort().at(-1)!;
    const min = addDays(`${lo.slice(0, 7)}-01`, 31 * 5);
    if (hi < min) hi = min;
    return monthsBetween(lo.slice(0, 7), hi.slice(0, 7));
  }, [rows, today]);
  const start = `${months[0]}-01`;
  const last = months[months.length - 1];
  const end = `${last}-${String(daysIn(last)).padStart(2, '0')}`;
  const timelineW = months.length * MONTH_W;
  // Empty space after the last month so a chip placed after a bar at the chart's end
  // ("Not Started") can be scrolled fully into view.
  const tailW = 160;

  /** x of the start of a day on the timeline, clamped to the chart. */
  const dayX = (iso: string) => {
    if (iso < start) return 0;
    if (iso > end) return timelineW;
    const key = iso.slice(0, 7);
    const i = months.indexOf(key);
    return i * MONTH_W + ((+iso.slice(8, 10) - 1) / daysIn(key)) * MONTH_W;
  };
  const todayX = today >= start && today <= end ? dayX(today) : null;
  const colorOf = (r: Installation) =>
    colorBy === 'branch' ? (r.branch ? BRANCH_COLOR[r.branch] : NO_COLOR) : (SCOPE_COLOR[(r.scope ?? '').toUpperCase()] ?? NO_COLOR);

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3">
      {/* Figma 651:32054 — search, colour toggle, legends | dates, sort, columns */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {search}
          <div className="flex items-center gap-2.5" role="group" aria-label="Colour bars by">
            {(['branch', 'scope'] as ColorBy[]).map(c => (
              <button key={c} type="button" onClick={() => setColorBy(c)} aria-pressed={colorBy === c}
                className={cn('inline-flex h-9 cursor-pointer items-center rounded-[6px] border px-3 text-[13px] font-semibold leading-[1.4]',
                  colorBy === c
                    ? 'border-transparent bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950'
                    : 'border-ui-body bg-ui-page-bg text-ui-body hover:text-ui-heading')}>
                {c === 'branch' ? 'Color by Branch' : 'Color by Company'}
              </button>
            ))}
          </div>
          <Legend label="Bar colours">
            {colorBy === 'branch'
              ? BRANCHES.map(b => <LegendItem key={b} color={LEGEND_COLOR[b]} label={b} />)
              : Object.entries(SCOPE_COLOR).map(([k, c]) => <LegendItem key={k} color={c} label={k.toLowerCase().replace(/\b\w/g, m => m.toUpperCase())} />)}
          </Legend>
          <Legend label="Bar markings">
            <span className="inline-flex items-center gap-2 text-[12px] font-medium leading-4 text-[var(--status-t0-fg)]">
              {/* Figma 651:32080 "Subtract": a striped rounded square, no outline */}
              <span className="size-4 rounded-[3px] bg-[repeating-linear-gradient(-36deg,var(--status-t0-fg)_0_2.2px,transparent_2.2px_4.6px)]" aria-hidden />
              Tentative
            </span>
            <span className="inline-flex items-center gap-2 text-[12px] font-medium leading-4 text-[var(--color-error-normal)]">
              <span className="size-4 rounded-[3px] border-[1.5px] border-[var(--color-error-normal)]" aria-hidden />
              Overdue / double-booked
            </span>
            <span className="inline-flex items-center gap-2 text-[12px] font-medium leading-4 text-[var(--color-accent-500,#E63700)]">
              <span className="h-4 w-[3px] bg-[var(--color-accent-500,#E63700)]" aria-hidden />
              Today
            </span>
          </Legend>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dateRange}
          {sortControl}
          <ColumnsMenu<GanttColumn> columns={GANTT_COLUMNS} hidden={hidden} onToggle={onToggleCol} onSetAll={onSetAllCols} />
        </div>
      </div>

      {/* Layers: grid / today line 1, bar chips 2, sticky left columns 3, heading row 4, its left cell 5 —
          so nothing on the timeline can paint over the project columns while scrolling. */}
      <div className="max-h-[calc(100dvh-280px)] min-w-0 max-w-full overflow-auto overscroll-x-contain rounded-[8px] border border-ui-divider bg-ui-page-bg">
        <div style={{ width: leftW + timelineW + tailW }}>
          {/* Figma 651:32116 / 651:32207 — column headings */}
          <div className="sticky top-0 z-[4] flex h-[46px] border-b border-ui-divider bg-ui-surface">
            <div className="sticky left-0 z-[5] flex shrink-0 border-r border-ui-divider bg-ui-surface" style={{ width: leftW }}>
              {cols.map((c, i) => (
                <div key={c.key} className={cn('flex items-center pr-2 text-[12px] font-semibold leading-[1.4] text-ui-body', i === 0 ? 'pl-4' : c.key === 'branch' || c.key === 'team' ? 'pl-2' : 'pl-0')} style={{ width: c.w }}>
                  {c.label}
                </div>
              ))}
            </div>
            {months.map(m => (
              <div key={m} className={cn('flex shrink-0 items-center justify-center border-r border-ui-divider text-[16px] font-semibold leading-[1.4]', HEADING)} style={{ width: MONTH_W }}>
                {monthHead(m)}
              </div>
            ))}
            <div className="shrink-0" style={{ width: tailW }} aria-hidden />
          </div>

          {/* Figma 651:32129 / 651:32222 — one row per installation */}
          {rows.map(r => {
            const s = r.planned_start, f = r.planned_finish ?? r.planned_start;
            const chip = chipOf(r, today);
            const red = chip.label === 'Overdue' || clashes.has(r.id);
            const tentative = r.confidence === 'Tentative';
            const color = colorOf(r);
            const x0 = s ? dayX(s) : 0;
            const x1 = f ? dayX(addDays(f, 1)) : 0;
            const no = projectNumber(r.project_no);
            const projectId = no ? projectByNo[no] : undefined;
            const members = headcount(r);
            // Chip ≈ 8px padding + ~8.5px per character at 15px. A short install (1–2 days) still draws a bar
            // wide enough to hold its chip with 10px each side — the chip always sits inside the bar.
            const barW = Math.max(x1 - x0, 8 + chip.label.length * 8.5 + 20);
            const title = `${r.project_no ?? ''} ${r.project_name ?? ''}\n${s ? `${dayMonth(s)} - ${dayMonth(f!)}` : 'No dates'} · ${chip.label}${clashes.has(r.id) ? '\nDouble-booked' : ''}`;
            return (
              <div key={r.id} className="flex border-b border-ui-divider" style={{ height: ROW_H }}>
                <div className="sticky left-0 z-[3] flex shrink-0 items-center border-r border-ui-divider bg-ui-page-bg" style={{ width: leftW }}>
                  {cols.map(c => {
                    switch (c.key) {
                      case 'no': return (
                        <Cell key={c.key} w={c.w} className="pl-4 pr-2 font-semibold">
                          {projectId
                            ? <Link href={`/projects/${projectId}`} className={cn('truncate underline-offset-2 hover:underline', HEADING)}>{r.project_no || '—'}</Link>
                            : <span className={cn('truncate', HEADING)}>{r.project_no || '—'}</span>}
                        </Cell>
                      );
                      case 'name': return <Cell key={c.key} w={c.w} className={cn('pr-2 font-semibold', HEADING)} title={r.project_name ?? undefined}>{r.project_name || '—'}</Cell>;
                      case 'branch': return (
                        <Cell key={c.key} w={c.w} className="px-2">
                          {r.branch
                            ? <span className="inline-flex items-center justify-center rounded-[4px] px-4 py-2 text-[12px] font-medium leading-4 text-white" style={{ background: BRANCH_COLOR[r.branch] }}>{r.branch}</span>
                            : <span className="text-ui-text-secondary">—</span>}
                        </Cell>
                      );
                      case 'team': return (
                        <Cell key={c.key} w={c.w} className="pl-2 pr-4" title={r.team ?? undefined}>
                          {/* Long team names end in "…" inside the chip (full name on hover), never cut mid-letter. */}
                          {r.team
                            ? <span className={cn('flex h-[30px] min-w-0 max-w-full items-center rounded-[4px] bg-ui-input-bg pl-4 pr-2.5 text-[14px] font-medium leading-4', HEADING)}>
                                <span className="min-w-0 truncate">{r.team}</span>
                              </span>
                            : <span className="text-ui-text-secondary">TBD</span>}
                        </Cell>
                      );
                      case 'members': return <Cell key={c.key} w={c.w} className={cn('pr-2 text-[14px] font-semibold', HEADING)}>{members || <span className="text-ui-text-secondary">—</span>}</Cell>;
                      case 'dates': return <Cell key={c.key} w={c.w} className={cn('pr-2 text-[14px] font-medium', HEADING)}>{s ? `${dayMonth(s)} - ${dayMonth(f!)}` : <span className="text-ui-text-secondary">No dates</span>}</Cell>;
                    }
                  })}
                </div>

                <div className="relative shrink-0" style={{ width: timelineW + tailW }}>
                  {/* month columns: dashed weeks, solid month end — drawn over the bar, as in Figma 651:32224 */}
                  <div className="pointer-events-none absolute inset-0 z-[1] flex" aria-hidden>
                    {months.map(m => (
                      <div key={m} className="flex h-full shrink-0" style={{ width: MONTH_W }}>
                        {[0, 1, 2, 3].map(q => <div key={q} className={cn('h-full flex-1 border-r border-ui-divider', q < 3 && 'border-dashed')} />)}
                      </div>
                    ))}
                  </div>
                  {s && (
                    <div title={title}
                      className={cn('absolute top-1.5 flex h-9 items-center rounded-[4px]', red && 'border-[1.5px] border-[var(--color-error-normal)]')}
                      style={{
                        left: x0, width: barW,
                        background: tentative
                          ? `repeating-linear-gradient(135deg, ${color} 0 6px, color-mix(in srgb, ${color} 45%, transparent) 6px 12px)`
                          : color,
                      }}>
                      <span className={cn('inline-flex h-[23px] shrink-0 items-center whitespace-nowrap rounded-[4px] px-1 text-[15px] font-medium leading-4',
                        // Figma 651:32420: Overdue in the t10 status tones; others on the elevated surface.
                        chip.red ? 'z-[2] bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]' : cn('z-[2] bg-ui-surface-elevated', HEADING),
                        // Sticky to the bar's visible start (just right of the project columns), so a bar that
                        // starts off-screen keeps its chip in view and inside the bar — never over the Team column.
                        'sticky ml-2.5')}
                        style={{ left: leftW + 10 }}>
                        {chip.label}
                      </span>
                    </div>
                  )}
                  {todayX !== null && <div className="pointer-events-none absolute inset-y-0 z-[1] w-0.5 bg-[var(--color-accent-500,#E63700)]" style={{ left: todayX }} aria-hidden />}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="m-0 p-8 text-center text-[13px] text-ui-text-secondary">No projects match these filters.</p>}
        </div>
      </div>
    </div>
  );
}

function Cell({ w, className, title, children }: { w: number; className?: string; title?: string; children: React.ReactNode }) {
  return <div className={cn('flex min-w-0 items-center truncate text-[13px] leading-[1.4]', className)} style={{ width: w }} title={title}>{children}</div>;
}

function Legend({ label, children }: { label: string; children: React.ReactNode }) {
  return <div role="group" aria-label={label} className="flex h-9 items-center gap-5 rounded-[6px] border border-[#5E6F87] px-4">{children}</div>;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-medium leading-4" style={{ color }}>
      <span className="size-2 rounded-[2px]" style={{ background: color }} aria-hidden />{label}
    </span>
  );
}
