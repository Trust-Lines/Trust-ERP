'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Award, CircleCheck, ClipboardCheck, Hammer, Loader, Ship, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BRANCHES, addDays, alertOf, type Branch, type Clash, type Installation,
} from '@/lib/installations/compute';
import {
  LIFE_STAGE, currentStage, lifecycleSegments, type LifeSegment, type LifeStage, type ProjectMilestones,
} from '@/lib/installations/lifecycle';
import { projectNumber } from '@/lib/keyClients/match';
import { HEADING, SCOPE_COLOR } from './shared';

// Figma 784:18261 — Gantt chart: a project list on the left (number chip, store, region, dates,
// assignee, current stage) tinted in the project's current stage colour, and on the right one
// 300px column per month (dashed lines split it into weeks) with the project's life drawn as dated
// stages — a dark chip at the start of each stage. Only stages with real dates are drawn
// (lib/installations/lifecycle). Overdue / double-booked installs are outlined red, tentative
// ones striped, and an accent line marks today.
const MONTH_W = 300;
const ROW_H = 49;
type ColorBy = 'branch' | 'scope';

// Legend colours from the design (lighter than the fills so the text stays readable).
const LEGEND_COLOR: Record<Branch, string> = { NE: '#4A7599', SE: '#607D39', NW: '#2C64BE', CVW: '#A98B81' };
// Region chips — same colours as the dashboard's branch headers (Figma 818:31889 …).
const REGION: Record<Branch, { color: string; label: string }> = {
  NE: { color: '#5E758E', label: 'NE' },
  SE: { color: '#68715B', label: 'SE' },
  NW: { color: 'rgba(164,42,44,0.84)', label: 'NW' },
  CVW: { color: '#624D46', label: 'W' },
};
const STAGE_ICON: Record<LifeStage, LucideIcon> = {
  opportunity: Award, production: Loader, ready_to_receive: ClipboardCheck, ready: ClipboardCheck,
  shipped: Ship, installation: Hammer, completed: CircleCheck,
};

const LEFT = [
  { key: 'no', label: 'Project #', w: 129 },
  { key: 'name', label: 'Project/Store', w: 155 },
  { key: 'region', label: 'Region', w: 90 },
  { key: 'dates', label: 'Start - Finish', w: 154 },
  { key: 'assignee', label: 'Assigned to', w: 147 },
  { key: 'status', label: 'Status', w: 130 },
] as const;
const LEFT_W = LEFT.reduce((n, c) => n + c.w, 0);

const fg = (s: LifeStage) => `var(--board-${LIFE_STAGE[s].tone}-fg)`;
const bg = (s: LifeStage) => `var(--board-${LIFE_STAGE[s].tone}-bg)`;

const daysIn = (key: string) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 0)).getUTCDate();
const monthHead = (key: string) =>
  new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).toUpperCase();
/** "10 AUG" */
const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();
/** Every yyyy-mm from `a` to `b` (inclusive). */
function monthsBetween(a: string, b: string): string[] {
  const out: string[] = [];
  let y = +a.slice(0, 4), m = +a.slice(5, 7);
  const ey = +b.slice(0, 4), em = +b.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
/** Width a full chip needs (icon + label at 12px); narrower stages show the icon only. */
const chipWidth = (label: string) => 34 + label.length * 6.4;

export function GanttTab({ rows, months: planMonths, today, clashes, projectByNo, milestonesByNo }: {
  rows: Installation[]; months: string[]; today: string; clashes: Map<string, Clash[]>; projectByNo: Record<string, string>;
  milestonesByNo: Record<string, ProjectMilestones>;
}) {
  const [colorBy, setColorBy] = React.useState<ColorBy>('branch');

  const lives = React.useMemo(() => rows.map(r => {
    const no = projectNumber(r.project_no);
    const segments = lifecycleSegments(no ? milestonesByNo[no] ?? null : null, r, today);
    return { row: r, segments, stage: currentStage(segments, today) };
  }), [rows, milestonesByNo, today]);

  // The plan's months, widened to every drawn stage (production often starts months earlier).
  const months = React.useMemo(() => {
    const ds = lives.flatMap(l => l.segments.flatMap(s => [s.start, s.end]));
    const lo = [planMonths[0] ? `${planMonths[0]}-01` : null, ...ds].filter((x): x is string => !!x).sort()[0];
    const hi = [planMonths.at(-1) ? `${planMonths.at(-1)}-01` : null, ...ds].filter((x): x is string => !!x).sort().at(-1);
    return lo && hi ? monthsBetween(lo, hi) : planMonths;
  }, [lives, planMonths]);

  const first = months[0];
  const last = months[months.length - 1];
  const start = first ? `${first}-01` : today;
  const end = last ? `${last}-${String(daysIn(last)).padStart(2, '0')}` : today;
  const timelineW = months.length * MONTH_W;

  /** x of the start of a day (yyyy-mm-dd) on the timeline, clamped to the chart. */
  const dayX = (iso: string) => {
    if (iso < start) return 0;
    if (iso > end) return timelineW;
    const key = iso.slice(0, 7);
    const i = months.indexOf(key);
    if (i < 0) return iso < start ? 0 : timelineW;
    return i * MONTH_W + ((+iso.slice(8, 10) - 1) / daysIn(key)) * MONTH_W;
  };
  const todayX = today >= start && today <= end ? dayX(today) : null;
  const installColor = (r: Installation) =>
    colorBy === 'branch' ? (r.branch ? LEGEND_COLOR[r.branch] : '#8A94A3') : (SCOPE_COLOR[(r.scope ?? '').toUpperCase()] ?? '#8A94A3');

  return (
    <div className="flex flex-col gap-3">
      {/* Figma 784:18355 — colour toggle + legends */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2.5" role="group" aria-label="Colour installation bars by">
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
            <div className="sticky left-0 z-[4] flex border-r border-ui-body bg-ui-surface" style={{ width: LEFT_W }}>
              {LEFT.map((c, i) => (
                <div key={c.key} className={cn('flex items-center px-2 text-[12px] font-semibold leading-[1.4] text-ui-body', i === 0 && 'pl-4')} style={{ width: c.w }}>
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
          {lives.map(({ row: r, segments, stage }) => {
            const s = r.planned_start, f = r.planned_finish ?? r.planned_start;
            const alert = alertOf(r, today);
            const red = !!alert?.text.startsWith('Overdue') || clashes.has(r.id);
            const tentative = r.confidence === 'Tentative';
            const tint = stage ? bg(stage) : undefined;
            const ink = stage ? fg(stage) : undefined;
            const no = projectNumber(r.project_no);
            const projectId = no ? projectByNo[no] : undefined;
            const StatusIcon = stage ? STAGE_ICON[stage] : null;
            return (
              <div key={r.id} className="flex border-b border-ui-divider" style={{ height: ROW_H }}>
                {/* Figma 818:11615 — the row in its current stage's tint, text in the stage colour */}
                <div className={cn('sticky left-0 z-[2] flex items-center border-r border-ui-body', !stage && 'bg-ui-page-bg')}
                  style={{ width: LEFT_W, background: tint, color: ink }}>
                  <Cell w={LEFT[0].w} className="px-2">
                    <ProjectChip text={r.project_no || '—'} href={projectId ? `/projects/${projectId}` : null} stage={stage} />
                  </Cell>
                  <Cell w={LEFT[1].w} className={cn('font-semibold', !stage && HEADING)} title={r.project_name ?? undefined}>{r.project_name || '—'}</Cell>
                  <Cell w={LEFT[2].w}>
                    {r.branch
                      ? <span className="inline-flex h-[21px] w-[43px] items-center justify-center rounded-[2px] text-[16px] font-medium leading-4 text-white" style={{ background: REGION[r.branch].color }} title={r.branch}>{REGION[r.branch].label}</span>
                      : <span className="opacity-60">—</span>}
                  </Cell>
                  <Cell w={LEFT[3].w} className={cn('text-[14px] font-medium', !stage && HEADING)}>{s ? `${dayMonth(s)} - ${dayMonth(f!)}` : '—'}</Cell>
                  <Cell w={LEFT[4].w} className={cn('text-[14px] font-medium', !stage && HEADING)} title={r.pm_name ?? r.team ?? undefined}>
                    {r.pm_name || r.team || <span className="opacity-60">TBD</span>}
                  </Cell>
                  <Cell w={LEFT[5].w} className="gap-1 text-[12px] font-medium leading-4">
                    {stage && StatusIcon
                      ? <><StatusIcon size={14} aria-hidden className="shrink-0" /><span className="truncate">{LIFE_STAGE[stage].label}</span></>
                      : <span className="text-ui-text-secondary">No dates yet</span>}
                  </Cell>
                </div>

                <div className="relative shrink-0" style={{ width: timelineW, background: tint ? `color-mix(in srgb, ${tint} 45%, transparent)` : undefined }}>
                  {/* month columns, dashed weeks */}
                  <div className="absolute inset-0 flex" aria-hidden>
                    {months.map(m => (
                      <div key={m} className="flex h-full shrink-0 border-r border-ui-text-secondary/40" style={{ width: MONTH_W }}>
                        {[0, 1, 2, 3].map(q => <div key={q} className={cn('h-full flex-1', q < 3 && 'border-r border-dashed border-ui-text-secondary/40')} />)}
                      </div>
                    ))}
                  </div>
                  {segments.map(seg => (
                    <Segment key={seg.stage} seg={seg} x0={dayX(seg.start)} x1={dayX(addDays(seg.end, 1))}
                      install={seg.stage === 'installation' ? { color: installColor(r), red, tentative } : null}
                      title={`${r.project_no ?? ''} ${r.project_name ?? ''}\n${LIFE_STAGE[seg.stage].label}: ${dayMonth(seg.start)}${seg.end !== seg.start ? ` - ${dayMonth(seg.end)}` : ''}${seg.open ? ' (ongoing)' : ''}${seg.stage === 'installation' && alert ? `\n${alert.text}` : ''}${seg.stage === 'installation' && clashes.has(r.id) ? '\nDouble-booked' : ''}`} />
                  ))}
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

/** One dated stage: a tinted span with the stage's dark chip at its start (Figma "Status Chip"). */
function Segment({ seg, x0, x1, install, title }: {
  seg: LifeSegment; x0: number; x1: number; title: string;
  /** The installation stage keeps the plan's own signals: branch / company fill, red outline, stripes. */
  install: { color: string; red: boolean; tentative: boolean } | null;
}) {
  const w = Math.max(6, x1 - x0);
  const label = LIFE_STAGE[seg.stage].label;
  const Icon = STAGE_ICON[seg.stage];
  const full = w >= chipWidth(label) + 8;
  const fill = install
    ? (install.tentative
      ? `repeating-linear-gradient(135deg, color-mix(in srgb, ${install.color} 55%, transparent) 0 5px, color-mix(in srgb, ${install.color} 20%, transparent) 5px 10px)`
      : `color-mix(in srgb, ${install.color} 35%, transparent)`)
    : `color-mix(in srgb, ${bg(seg.stage)} 70%, transparent)`;
  return (
    <div
      title={title}
      className={cn('absolute top-1/2 flex h-9 -translate-y-1/2 items-center rounded-[4px] border', seg.open && 'border-dashed', install?.red && 'border-[1.5px]')}
      style={{
        left: x0, width: w, background: fill,
        borderColor: install?.red ? 'var(--color-error-normal)' : `color-mix(in srgb, ${fg(seg.stage)} 45%, transparent)`,
      }}
    >
      <span
        className={cn('ml-1 inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] text-[12px] font-medium leading-4', full ? 'pl-2 pr-3' : 'px-1')}
        style={{ background: fg(seg.stage), color: bg(seg.stage) }}
      >
        <Icon size={14} aria-hidden className="shrink-0" />
        {full ? label : <span className="sr-only">{label}</span>}
      </span>
    </div>
  );
}

function ProjectChip({ text, href, stage }: { text: string; href: string | null; stage: LifeStage | null }) {
  const cls = 'inline-flex max-w-full items-center justify-center truncate rounded-[4px] px-4 py-2 text-[16px] font-medium leading-4 no-underline';
  const style = stage ? { background: fg(stage), color: bg(stage) } : undefined;
  const plain = !stage && 'bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950';
  return href
    ? <Link href={href} className={cn(cls, plain, 'hover:brightness-110')} style={style}>{text}</Link>
    : <span className={cn(cls, plain)} style={style}>{text}</span>;
}

function Cell({ w, className, title, children }: { w: number; className?: string; title?: string; children: React.ReactNode }) {
  return <div className={cn('flex min-w-0 items-center truncate px-2 text-[13px]', className)} style={{ width: w }} title={title}>{children}</div>;
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
