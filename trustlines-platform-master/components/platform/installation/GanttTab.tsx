'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  BRANCHES, addDays, alertOf, fmtDate, headcount, monthLabel, weekStarts, type Clash, type Installation,
} from '@/lib/installations/compute';
import { BRANCH_COLOR, ProjectNo, SCOPE_COLOR, TH } from './shared';

const WK = 24;   // px per week
type ColorBy = 'branch' | 'scope';

// The workbook's Gantt sheet: one row per project, one column per week (Sundays, "Wk of 01-Nov"),
// a bar over every week the planned dates touch. Better than the sheet: coloured by branch or
// company, a today line, tentative jobs striped, overdue / double-booked jobs outlined red.
export function GanttTab({ rows, months, today, clashes, projectByNo }: {
  rows: Installation[]; months: string[]; today: string; clashes: Map<string, Clash[]>; projectByNo: Record<string, string>;
}) {
  const [colorBy, setColorBy] = React.useState<ColorBy>('branch');
  const from = `${months[0]}-01`;
  // Last day of the plan's last month.
  const [ly, lm] = months[months.length - 1].split('-').map(Number);
  const to = addDays(lm === 12 ? `${ly + 1}-01-01` : `${ly}-${String(lm + 1).padStart(2, '0')}-01`, -1);
  const weeks = weekStarts(from, to);
  const start = weeks[0];
  const end = addDays(weeks[weeks.length - 1], 6);
  const dayX = (iso: string) => {
    const clamped = iso < start ? start : iso > end ? end : iso;
    return (Date.parse(clamped) - Date.parse(start)) / 86_400_000 / 7 * WK;
  };
  // Month band above the week columns.
  const monthBand: { key: string; span: number }[] = [];
  for (const w of weeks) {
    const k = w.slice(0, 7);
    const last = monthBand[monthBand.length - 1];
    if (last && last.key === k) last.span++; else monthBand.push({ key: k, span: 1 });
  }
  const todayX = today >= start && today <= end ? dayX(today) : null;
  const colorOf = (r: Installation) =>
    colorBy === 'branch' ? (r.branch ? BRANCH_COLOR[r.branch] : '#8A94A3') : (SCOPE_COLOR[(r.scope ?? '').toUpperCase()] ?? '#8A94A3');

  const LEFT = [{ l: 'Project #', w: 96 }, { l: 'Project / Store', w: 140 }, { l: 'Br.', w: 44 }, { l: 'Assigned team', w: 170 }, { l: 'Mem.', w: 44 }, { l: 'Start – Finish', w: 116 }];
  const leftW = LEFT.reduce((n, c) => n + c.w, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-ui-body">
        <span className="font-medium">Colour by</span>
        {(['branch', 'scope'] as ColorBy[]).map(c => (
          <button key={c} type="button" onClick={() => setColorBy(c)} aria-pressed={colorBy === c}
            className={cn('h-8 cursor-pointer rounded-[6px] border px-3 text-[12px]', colorBy === c ? 'border-transparent bg-[var(--ui-btn-solid)] font-semibold text-[var(--ui-btn-solid-fg)]' : 'border-ui-divider bg-ui-input-bg text-ui-body')}>
            {c === 'branch' ? 'Branch' : 'Company'}
          </button>
        ))}
        <span className="ml-2 flex flex-wrap items-center gap-3">
          {(colorBy === 'branch' ? BRANCHES.map(b => [b, BRANCH_COLOR[b]] as const) : Object.entries(SCOPE_COLOR)).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px]" style={{ background: c }} />{k}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[2px] bg-[repeating-linear-gradient(45deg,#8A94A3_0_3px,transparent_3px_6px)]" />Tentative</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[2px] border-2 border-[#C0262D]" />Overdue / double-booked</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-[#C0262D]" />Today</span>
        </span>
      </div>

      <div className="max-h-[calc(100dvh-280px)] overflow-auto rounded-[8px] border border-ui-divider bg-ui-surface">
        <div style={{ width: leftW + weeks.length * WK }}>
          {/* header: months + weeks */}
          <div className="sticky top-0 z-[3] flex">
            <div className="sticky left-0 z-[4] flex" style={{ width: leftW }}>
              {LEFT.map(c => <div key={c.l} className={cn(TH, 'flex items-end border-r border-white/15')} style={{ width: c.w, height: 58 }}>{c.l}</div>)}
            </div>
            <div className="flex flex-col">
              <div className="flex">
                {monthBand.map(m => (
                  <div key={m.key} className="truncate border-b border-r border-white/20 bg-[var(--color-secondary-700)] px-1 py-1 text-[10px] font-semibold uppercase text-white dark:bg-primary-700" style={{ width: m.span * WK }}>
                    {m.span >= 3 ? monthLabel(m.key, true) : ''}
                  </div>
                ))}
              </div>
              <div className="flex">
                {weeks.map(w => (
                  <div key={w} title={`Week of ${fmtDate(w)}`} className="flex h-[34px] items-end justify-center border-r border-white/10 bg-[#2C5F8A] pb-1 text-[9px] text-white/90 dark:bg-primary-600" style={{ width: WK }}>
                    {+w.slice(8)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* rows */}
          {rows.map(r => {
            const dated = !!r.planned_start;
            const s = r.planned_start ?? '', f = r.planned_finish ?? r.planned_start ?? '';
            const visible = dated && f >= start && s <= end;
            const x0 = visible ? dayX(s) : 0, x1 = visible ? dayX(addDays(f, 1)) : 0;
            const alert = alertOf(r, today);
            const red = clashes.has(r.id) || alert?.text.startsWith('Overdue');
            const color = colorOf(r);
            return (
              <div key={r.id} className="group flex border-b border-ui-divider hover:bg-ui-hover-bg/50">
                <div className="sticky left-0 z-[2] flex bg-ui-surface group-hover:bg-ui-hover-bg" style={{ width: leftW }}>
                  {[
                    <ProjectNo key="n" row={r} projectByNo={projectByNo} />, r.project_name, r.branch, r.team || 'TBD', headcount(r),
                    dated ? `${fmtDate(s).slice(0, 6)} – ${fmtDate(f).slice(0, 6)}` : '—',
                  ].map((v, i) => (
                    <div key={i} className="truncate border-r border-ui-divider px-2 py-1.5 text-[11px] text-ui-body" style={{ width: LEFT[i].w }} title={typeof v === 'string' ? v : undefined}>{v}</div>
                  ))}
                </div>
                <div className="relative" style={{ width: weeks.length * WK }}>
                  {/* week grid */}
                  <div className="absolute inset-0 flex">{weeks.map(w => <div key={w} className="h-full border-r border-ui-divider/50" style={{ width: WK }} />)}</div>
                  {todayX !== null && <div className="absolute inset-y-0 z-[1] w-0.5 bg-[#C0262D]/70" style={{ left: todayX }} />}
                  {visible && (
                    <div
                      title={`${r.project_no ?? ''} ${r.project_name ?? ''}\n${fmtDate(s)} – ${fmtDate(f)}${r.team ? `\n${r.team}` : ''}${alert ? `\n${alert.text}` : ''}`}
                      className={cn('absolute top-1 bottom-1 rounded-[3px]', red && 'outline outline-2 outline-[#C0262D]', r.status === 'Completed' && 'opacity-40')}
                      style={{
                        left: x0, width: Math.max(4, x1 - x0),
                        background: r.confidence === 'Tentative' ? `repeating-linear-gradient(45deg, ${color} 0 4px, transparent 4px 8px)` : color,
                        border: r.confidence === 'Tentative' ? `1.5px solid ${color}` : undefined,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="p-6 text-center text-[12px] italic text-ui-text-secondary">No projects match these filters.</p>}
        </div>
      </div>
    </div>
  );
}
