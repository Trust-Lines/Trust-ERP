'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  BRANCHES, addDays, alertOf, headcount, type Branch, type Clash, type Installation,
} from '@/lib/installations/compute';
import { BRANCH_COLOR, HEADING, ProjectNo, SCOPE_COLOR } from './shared';

// Figma 638:28922 — Gantt chart: a Register-style project list on the left, one 300px column per
// month on the right (dashed lines split it into weeks), a bar over each project's planned dates
// with its status inside, overdue / double-booked bars outlined red, and an accent "today" line.
const MONTH_W = 300;
const ROW_H = 49;
type ColorBy = 'branch' | 'scope';

// Legend colours from the design (lighter than the bar fills so the text stays readable).
const LEGEND_COLOR: Record<Branch, string> = { NE: '#4A7599', SE: '#607D39', NW: '#2C64BE', CVW: '#A98B81' };

const LEFT = [
  { key: 'no', label: 'Project #', w: 115 },
  { key: 'name', label: 'Project/Store', w: 167 },
  { key: 'branch', label: 'Branch', w: 99 },
  { key: 'team', label: 'Assigned Team', w: 246 },
  { key: 'members', label: 'Members', w: 80 },
  { key: 'dates', label: 'Start - Finish', w: 140 },
] as const;
const LEFT_W = LEFT.reduce((n, c) => n + c.w, 0);

const daysIn = (key: string) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 0)).getUTCDate();
const monthHead = (key: string) =>
  new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).toUpperCase();
/** "10 AUG" */
const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();

export function GanttTab({ rows, months, today, clashes, projectByNo }: {
  rows: Installation[]; months: string[]; today: string; clashes: Map<string, Clash[]>; projectByNo: Record<string, string>;
}) {
  const [colorBy, setColorBy] = React.useState<ColorBy>('branch');
  const first = months[0];
  const last = months[months.length - 1];
  const start = `${first}-01`;
  const end = `${last}-${String(daysIn(last)).padStart(2, '0')}`;
  const timelineW = months.length * MONTH_W;

  /** x of the start of a day (yyyy-mm-dd) on the timeline, clamped to the plan. */
  const dayX = (iso: string) => {
    if (iso < start) return 0;
    if (iso > end) return timelineW;
    const key = iso.slice(0, 7);
    const i = months.indexOf(key);
    if (i < 0) return iso < start ? 0 : timelineW;
    return i * MONTH_W + ((+iso.slice(8, 10) - 1) / daysIn(key)) * MONTH_W;
  };
  const todayX = today >= start && today <= end ? dayX(today) : null;
  const colorOf = (r: Installation) =>
    colorBy === 'branch' ? (r.branch ? BRANCH_COLOR[r.branch] : '#8A94A3') : (SCOPE_COLOR[(r.scope ?? '').toUpperCase()] ?? '#8A94A3');

  return (
    <div className="flex flex-col gap-3">
      {/* Figma 638:29012 — colour toggle + legends */}
      <div className="flex flex-wrap items-center gap-2.5">
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
        <Legend>
          {colorBy === 'branch'
            ? BRANCHES.map(b => <LegendItem key={b} color={LEGEND_COLOR[b]} label={b} />)
            : Object.entries(SCOPE_COLOR).map(([k, c]) => <LegendItem key={k} color={c} label={k.toLowerCase().replace(/\b\w/g, m => m.toUpperCase())} />)}
        </Legend>
        <Legend>
          <span className="inline-flex items-center gap-2 text-[12px] font-medium leading-4 text-[var(--status-t0-fg)]">
            <span className="size-4 rounded-[3px] border border-[var(--status-t0-fg)] bg-[repeating-linear-gradient(135deg,var(--status-t0-fg)_0_1.5px,transparent_1.5px_4px)]" aria-hidden />
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

      <div className="max-h-[calc(100dvh-280px)] overflow-auto rounded-[8px] border border-ui-divider bg-ui-page-bg">
        <div style={{ width: LEFT_W + timelineW }}>
          {/* header */}
          <div className="sticky top-0 z-[3] flex h-[46px] border-b border-ui-divider bg-ui-surface">
            <div className="sticky left-0 z-[4] flex border-r border-ui-divider bg-ui-surface" style={{ width: LEFT_W }}>
              {LEFT.map((c, i) => (
                <div key={c.key} className={cn('flex items-center px-2 text-[12px] font-semibold leading-[1.4] text-ui-body', i === 0 && 'pl-4', c.key === 'members' && 'justify-center')} style={{ width: c.w }}>
                  {c.label}
                </div>
              ))}
            </div>
            {months.map(m => (
              <div key={m} className={cn('flex shrink-0 items-center justify-center border-r border-ui-divider text-[16px] font-semibold leading-[1.4]', HEADING)} style={{ width: MONTH_W }}>
                {monthHead(m)}
              </div>
            ))}
          </div>

          {/* rows */}
          {rows.map(r => {
            const s = r.planned_start, f = r.planned_finish ?? r.planned_start;
            const shown = !!s && !!f && f >= start && s <= end;
            const x0 = shown ? dayX(s!) : 0;
            const x1 = shown ? dayX(addDays(f!, 1)) : 0;
            const alert = alertOf(r, today);
            const overdue = !!alert?.text.startsWith('Overdue');
            const red = overdue || clashes.has(r.id);
            const color = colorOf(r);
            const tentative = r.confidence === 'Tentative';
            const label = overdue ? 'Overdue' : r.status ?? (tentative ? 'Tentative' : null);
            return (
              <div key={r.id} className="group flex border-b border-ui-divider" style={{ height: ROW_H }}>
                <div className="sticky left-0 z-[2] flex items-center border-r border-ui-divider bg-ui-page-bg" style={{ width: LEFT_W }}>
                  <Cell w={LEFT[0].w} className="pl-4"><ProjectNo row={r} projectByNo={projectByNo} /></Cell>
                  <Cell w={LEFT[1].w} className={cn('font-semibold', HEADING)} title={r.project_name ?? undefined}>{r.project_name || '—'}</Cell>
                  <Cell w={LEFT[2].w}>
                    {r.branch
                      ? <span className="inline-flex items-center justify-center rounded-[4px] px-4 py-2 text-[12px] font-medium leading-4 text-white" style={{ background: BRANCH_COLOR[r.branch] }}>{r.branch}</span>
                      : <span className="text-ui-text-secondary">—</span>}
                  </Cell>
                  <Cell w={LEFT[3].w} className={cn('uppercase', r.team ? HEADING : 'text-ui-text-secondary')} title={r.team ?? undefined}>{r.team || 'TBD'}</Cell>
                  <Cell w={LEFT[4].w} className={cn('justify-center font-semibold', HEADING)}>{headcount(r)}</Cell>
                  <Cell w={LEFT[5].w} className={cn('font-medium', HEADING)}>{s ? `${dayMonth(s)} - ${dayMonth(f!)}` : '—'}</Cell>
                </div>

                <div className="relative shrink-0" style={{ width: timelineW }}>
                  {/* month columns, dashed weeks */}
                  <div className="absolute inset-0 flex" aria-hidden>
                    {months.map(m => (
                      <div key={m} className="flex h-full shrink-0 border-r border-ui-divider" style={{ width: MONTH_W }}>
                        {[0, 1, 2, 3].map(q => <div key={q} className={cn('h-full flex-1', q < 3 && 'border-r border-dashed border-ui-divider')} />)}
                      </div>
                    ))}
                  </div>
                  {shown && (
                    <div
                      title={`${r.project_no ?? ''} ${r.project_name ?? ''}\n${dayMonth(s!)} - ${dayMonth(f!)}${r.team ? `\n${r.team}` : ''}${alert ? `\n${alert.text}` : ''}${clashes.has(r.id) ? '\nDouble-booked' : ''}`}
                      className={cn('absolute top-1/2 flex h-9 -translate-y-1/2 items-center overflow-hidden rounded-[4px]', red && 'border border-[var(--color-error-normal)]')}
                      style={{
                        left: x0, width: Math.max(6, x1 - x0),
                        background: tentative ? `repeating-linear-gradient(135deg, ${color} 0 5px, color-mix(in srgb, ${color} 35%, transparent) 5px 10px)` : color,
                      }}
                    >
                      {label && x1 - x0 > 60 && (
                        <span className={cn('ml-2.5 inline-flex h-[23px] shrink-0 items-center rounded-[4px] px-1 text-[15px] font-medium leading-4',
                          overdue ? 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]' : 'bg-white')}
                          style={overdue ? undefined : { color }}>
                          {label}
                        </span>
                      )}
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
  return <div className={cn('flex min-w-0 items-center truncate px-2 text-[13px] text-ui-body', className)} style={{ width: w }} title={title}>{children}</div>;
}

function Legend({ children }: { children: React.ReactNode }) {
  return <div className="flex h-9 items-center gap-5 rounded-[6px] border border-ui-body px-4">{children}</div>;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-medium leading-4" style={{ color }}>
      <span className="size-2 rounded-[2px]" style={{ background: color }} aria-hidden />{label}
    </span>
  );
}
