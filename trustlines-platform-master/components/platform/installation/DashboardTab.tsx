'use client';

import * as React from 'react';
import Image from 'next/image';
import { BriefcaseBusiness, CircleAlert, CircleCheck, ClockFading, Drill as DrillIcon, MoveHorizontal, RefreshCcwDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BRANCHES, alertOf, countBy, dashboardStats, fmtDate, monthLabel, monthRows, needsAttention,
  startingWithin, statusTable, type AlertTone, type MonthRow, type Branch, type Clash, type InstallStatus, type Installation,
} from '@/lib/installations/compute';
import { BRANCH_COLOR, HEADING, ProjectNo, TH } from './shared';

type Drill = 'attention' | 'overdue' | 'clash' | 'update' | 'soon' | 'now';

type Props = {
  rows: Installation[];
  today: string;
  clashes: Map<string, Clash[]>;
  months: string[];
  projectByNo: Record<string, string>;
  /** Jump to the register filtered to one problem (a KPI tile click). */
  onDrill: (filter: Drill | null) => void;
};

// Figma 620:33809 — Installation Plan dashboard. Everything is calculated from the register rows
// (lib/installations/compute.ts); the tiles drill into the register.
export function DashboardTab({ rows, today, clashes, months, projectByNo, onDrill }: Props) {
  const s = dashboardStats(rows, today, clashes);
  const attention = needsAttention(rows, today);
  const soon = startingWithin(rows, today, 30);
  const clashRows = rows.filter(r => clashes.has(r.id)).sort((a, b) => (a.planned_start ?? '').localeCompare(b.planned_start ?? ''));
  // The charts run from the first to the last month with any data (empty months in between stay,
  // so the time axis keeps its spacing); the plan's other tabs keep the full range.
  const perMonth = trimToData(monthRows(rows, months));
  const chartMonths = perMonth.map(m => m.month);

  const calendarIcon = <Image src="/icons/installation/calendar-chevrons-right.svg" width={24} height={24} alt="" unoptimized className="block size-6 brightness-0 invert" />;
  const tiles: { label: string; value: number; color: string; icon: React.ReactNode; drill: Drill | null }[] = [
    { label: 'Active Projects', value: s.active, color: '#1F4E79', icon: <BriefcaseBusiness size={24} />, drill: null },
    { label: 'Starting in 14 days', value: s.starting14, color: '#2E5BA3', icon: <ClockFading size={24} />, drill: 'soon' },
    { label: 'Installing Now', value: s.installingNow, color: '#4E7A2E', icon: <DrillIcon size={24} />, drill: 'now' },
    { label: 'Need Attention', value: s.needAttention, color: '#C2570C', icon: <CircleAlert size={24} />, drill: 'attention' },
    { label: 'Overdue', value: s.overdue, color: '#C0262D', icon: calendarIcon, drill: 'overdue' },
    { label: 'Double-booked projects', value: s.doubleBooked, color: '#C0262D', icon: <MoveHorizontal size={24} />, drill: 'clash' },
    { label: 'Statuses to update', value: s.statusesToUpdate, color: '#C2570C', icon: <RefreshCcwDot size={24} />, drill: 'update' },
    { label: 'Installers Booked (14 Days)', value: s.installersBooked14, color: '#1F4E79', icon: <CircleCheck size={24} />, drill: null },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-1 gap-y-[7px] sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(t => (
          <button
            key={t.label} type="button" disabled={!t.drill} onClick={() => onDrill(t.drill)}
            title={t.drill ? 'Show these in the register' : undefined}
            className={cn('flex min-w-0 items-center gap-2 rounded-[11px] border-0 py-1 pl-1 pr-4 text-left text-white',
              t.drill ? 'cursor-pointer transition-[filter] hover:brightness-110' : 'cursor-default')}
            style={{ background: t.color }}
          >
            <span className="flex size-[43px] shrink-0 items-center justify-center rounded-[8px] bg-white/15">{t.icon}</span>
            <span className="flex min-w-0 flex-col gap-1 pt-0.5">
              <span className="truncate text-[11px] leading-[0.9] tracking-[-0.242px]">{t.label}</span>
              <span className="text-[20px] font-semibold leading-4 tracking-[0.4px]">{t.value}</span>
            </span>
          </button>
        ))}
      </div>

      <Block title="Needs Attention">
        {attention.length === 0 ? <Empty>Nothing needs attention.</Empty> : (
          <DTable head={['Project #', 'Project/Store', 'Branch', 'Start', 'Finish', 'Status', 'Alert']}>
            {attention.map(r => {
              const a = alertOf(r, today)!;
              return (
                <tr key={r.id}>
                  <td className={DTD}><ProjectNo row={r} projectByNo={projectByNo} /></td>
                  <td className={cn(DTD, NAME)}>{r.project_name}</td>
                  <td className={DTD}><BranchTag branch={r.branch} /></td>
                  <td className={cn(DTD, DATE)}>{day(r.planned_start)}</td>
                  <td className={cn(DTD, DATE)}>{day(r.planned_finish)}</td>
                  <td className={DTD}><StatusTag status={r.status} /></td>
                  <td className={DTD}><AlertTag tone={a.tone} text={a.text} /></td>
                </tr>
              );
            })}
          </DTable>
        )}
      </Block>

      <Block title="Installer double-booking">
        {clashRows.length === 0 ? <Empty>No installer is booked on overlapping projects.</Empty> : (
          <DTable head={['Project #', 'Project/Store', 'Branch', 'Start', 'Finish', 'Clashes with #', 'Installers on two jobs at once']}>
            {clashRows.map(r => {
              const list = clashes.get(r.id)!;
              return (
                <tr key={r.id}>
                  <td className={DTD}><ProjectNo row={r} projectByNo={projectByNo} /></td>
                  <td className={cn(DTD, NAME)}>{r.project_name}</td>
                  <td className={DTD}><BranchTag branch={r.branch} /></td>
                  <td className={cn(DTD, DATE)}>{day(r.planned_start)}</td>
                  <td className={cn(DTD, DATE)}>{day(r.planned_finish)}</td>
                  <td className={cn(DTD, CLASH)}>{list.map(c => c.projectNo).join(', ')}</td>
                  <td className={cn(DTD, CLASH, 'whitespace-normal capitalize')}>{[...new Set(list.flatMap(c => c.people))].join(', ')}</td>
                </tr>
              );
            })}
          </DTable>
        )}
      </Block>

      <Block title="Starting in the next 30 Days">
        {soon.length === 0 ? <Empty>Nothing starts in the next 30 days.</Empty> : (
          <DTable head={['Project #', 'Project/Store', 'Branch', 'Start', 'Finish', 'Assigned PM', 'Confidence', 'Assigned Team']}>
            {soon.map(r => (
              <tr key={r.id}>
                <td className={DTD}><ProjectNo row={r} projectByNo={projectByNo} /></td>
                <td className={cn(DTD, NAME)}>{r.project_name}</td>
                <td className={DTD}><BranchTag branch={r.branch} /></td>
                <td className={cn(DTD, DATE)}>{day(r.planned_start)}</td>
                <td className={cn(DTD, DATE)}>{day(r.planned_finish)}</td>
                <td className={cn(DTD, 'font-semibold', HEADING)}>{r.pm_name || '—'}</td>
                <td className={DTD}>{r.confidence || '-'}</td>
                <td className={cn(DTD, 'whitespace-normal uppercase', HEADING)}>{r.team || 'TBD'}</td>
              </tr>
            ))}
          </DTable>
        )}
      </Block>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <Block title="By Status">
          <DTable head={['Status', 'Entered', 'Suggested']} center={[1, 2]}>
            {statusTable(rows, today).map(x => (
              <tr key={x.status}>
                <td className={DTD}><StatusTag status={x.status} small /></td>
                <td className={cn(DTD, NUM)}>{x.entered}</td>
                <td className={cn(DTD, NUM, x.suggested !== x.entered && 'text-[#C2570C] dark:text-[#FFB27A]')}>{x.suggested}</td>
              </tr>
            ))}
          </DTable>
        </Block>
        <Block title="Assigned PM">
          <DTable head={['PM', 'Projects', 'Installers']} center={[1, 2]}>
            {countBy(rows, r => r.pm_name?.trim() || null).sort((a, b) => b.projects - a.projects).map(x => (
              <tr key={x.key}>
                <td className={cn(DTD, x.key === 'Unassigned' ? 'italic text-ui-text-secondary' : HEADING)}>{x.key}</td>
                <td className={cn(DTD, NUM)}>{x.projects}</td>
                <td className={cn(DTD, NUM)}>{x.installers}</td>
              </tr>
            ))}
          </DTable>
        </Block>
        <Block title="By Branch">
          <DTable head={['Branch', 'Projects', 'Installers']} center={[1, 2]}>
            {countBy(rows, r => r.branch, BRANCHES).map(x => (
              <tr key={x.key}>
                <td className={DTD}>{x.key === 'Unassigned' ? <span className="italic text-ui-text-secondary">No branch</span> : <BranchTag branch={x.key as Branch} />}</td>
                <td className={cn(DTD, NUM)}>{x.projects}</td>
                <td className={cn(DTD, NUM)}>{x.installers}</td>
              </tr>
            ))}
          </DTable>
        </Block>
      </div>

      <div className="grid gap-4 xl:grid-cols-[726fr_1050fr]">
        <ChartCard title="Projects starting per month">
          <MonthBars months={chartMonths} values={perMonth.map(m => m.starting)} today={today} />
        </ChartCard>
        <ChartCard title="Installer assignments per month by branch">
          <BranchAreas months={chartMonths} series={BRANCHES.map(b => ({ key: b, color: BRANCH_COLOR[b], values: perMonth.map(m => m.byBranch[b]) }))} />
        </ChartCard>
      </div>
    </div>
  );
}

// ── building blocks (Figma table: surface header row, white rows, 8px radius) ─────────────────
const DTD = 'h-[49px] whitespace-nowrap border-t border-ui-divider px-4 text-[13px] text-ui-body';
const NAME = cn('font-semibold', HEADING);
const DATE = 'text-[14px] font-medium uppercase text-ui-text-secondary';
const NUM = cn('text-center text-[13px] font-medium', HEADING);
const CLASH = 'font-medium text-[var(--color-error-normal)] dark:text-[#FF8A8A]';
const day = (iso: string | null) => fmtDate(iso).toUpperCase() || '—';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className={cn('m-0 pl-1 pr-2 text-[24px] font-semibold leading-[1.35]', HEADING)}>{title}</h2>
      {children}
    </section>
  );
}

function DTable({ head, center = [], children }: { head: string[]; center?: number[]; children: React.ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-[8px] border border-ui-divider bg-ui-page-bg">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col"
                className={cn('h-[46px] whitespace-nowrap bg-ui-surface px-4 text-[12px] font-semibold leading-[1.4] text-ui-body', center.includes(i) ? 'text-center' : 'text-left')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 rounded-[8px] border border-ui-divider bg-ui-page-bg px-4 py-6 text-center text-[13px] text-ui-text-secondary">{children}</p>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-[8px] border border-ui-divider bg-ui-page-bg py-6 pl-6 pr-6 xl:pr-12">
      <h2 className={cn('m-0 text-[24px] font-semibold leading-[30px]', HEADING)}>{title}</h2>
      {children}
    </section>
  );
}

function BranchTag({ branch }: { branch: Branch | null }) {
  if (!branch) return <span className="text-ui-text-secondary">—</span>;
  return (
    <span className="inline-flex items-center justify-center rounded-[4px] px-4 py-2 text-[12px] font-medium leading-4 text-white" style={{ background: BRANCH_COLOR[branch] }}>
      {branch}
    </span>
  );
}

// Figma status chips: t0 grey, t2 blue, green, t10 red, amber — light fill, dark text.
const STATUS_CHIP: Record<InstallStatus, string> = {
  'Not Started': 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]',
  'In Progress': 'bg-[var(--status-t2-bg)] text-[var(--status-t2-fg)]',
  Completed: 'bg-[#DDF3E2] text-[#1E6B33] dark:bg-[#1E6B33] dark:text-[#DDF3E2]',
  Delayed: 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]',
  'On Hold': 'bg-[#FFF1D6] text-[#8A5A00] dark:bg-[#5C4410] dark:text-[#FFE2A8]',
};
const ALERT_CHIP: Record<AlertTone, string> = {
  red: 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]',
  amber: 'bg-[#FFF1D6] text-[#8A5A00] dark:bg-[#5C4410] dark:text-[#FFE2A8]',
  blue: 'bg-[var(--status-t2-bg)] text-[var(--status-t2-fg)]',
};
const CHIP = 'inline-flex items-center justify-center whitespace-nowrap rounded-[4px] px-4 py-2 font-semibold leading-4';

function StatusTag({ status, small }: { status: InstallStatus | null; small?: boolean }) {
  if (!status) return <span className="text-ui-text-secondary">—</span>;
  return <span className={cn(CHIP, STATUS_CHIP[status], small ? 'px-3 py-1.5 text-[12px] font-medium' : 'text-[14px]')}>{status}</span>;
}
function AlertTag({ tone, text }: { tone: AlertTone; text: string }) {
  return <span className={cn(CHIP, ALERT_CHIP[tone], 'text-[14px]')}>{text}</span>;
}

/** Months from the first to the last that has any data, at least MIN_CHART_MONTHS long (grown
 *  forward, then back, within the plan). No data at all keeps the whole range. */
const MIN_CHART_MONTHS = 3;
function trimToData(list: MonthRow[]): MonthRow[] {
  const has = (m: MonthRow) => m.starting > 0 || BRANCHES.some(b => m.byBranch[b] > 0);
  let lo = list.findIndex(has);
  if (lo < 0) return list;
  let hi = list.length - 1 - [...list].reverse().findIndex(has);
  while (hi - lo + 1 < MIN_CHART_MONTHS && (hi < list.length - 1 || lo > 0)) {
    if (hi < list.length - 1) hi++; else lo--;
  }
  return list.slice(lo, hi + 1);
}

// ── charts ────────────────────────────────────────────────────────────────────────────────────
const AXIS = 'var(--ui-text-secondary)';

function axisTop(max: number) {
  const step = max <= 4 ? 1 : max <= 8 ? 2 : max <= 20 ? 5 : max <= 40 ? 10 : 20;
  return { step, top: Math.max(step * 4, Math.ceil(max / step) * step) };
}
const monthTick = (m: string) => monthLabel(m, true).split(' ')[0].toUpperCase();
const monthYear = (m: string) => m.slice(0, 4);
const monthTitle = (m: string) => `${monthTick(m)} ${monthYear(m)}`;

/** Figma "Projects starting per month": pale accent columns, the hovered month solid with a tooltip. */
function MonthBars({ months, values, today }: { months: string[]; values: number[]; today: string }) {
  const W = 640, H = 266, L = 44, T = 20, PLOT_H = 220;
  const { step, top } = axisTop(Math.max(0, ...values));
  const colW = (W - L) / months.length;
  const barW = Math.min(31, colW * 0.62);
  const y = (v: number) => T + PLOT_H * (1 - v / top);
  const current = months.indexOf(today.slice(0, 7));
  const [hover, setHover] = React.useState<number | null>(null);
  const active = hover ?? (current >= 0 ? current : null);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="block h-auto w-full" role="img" aria-label="Projects starting per month"
        onMouseLeave={() => setHover(null)}>
        {Array.from({ length: top / step + 1 }, (_, k) => k * step).map(v => (
          <g key={v}>
            <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--ui-divider)" strokeOpacity={0.65} />
            <text x={L - 12} y={y(v) + 4} textAnchor="end" fontSize={12} fontWeight={500} fill={AXIS}>{v}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = L + colW * (i + 0.5);
          const v = values[i];
          const on = i === active;
          return (
            <g key={m} onMouseEnter={() => setHover(i)}>
              <rect x={L + colW * i} y={T} width={colW} height={PLOT_H} fill="transparent" />
              {v > 0 && <rect x={cx - barW / 2} y={y(v)} width={barW} height={T + PLOT_H - y(v)} fill="var(--color-accent-400)" fillOpacity={on ? 1 : 0.15} />}
              {on && v > 0 && <circle cx={cx} cy={y(v)} r={3} fill="var(--ui-page-bg)" stroke="var(--color-accent-400)" />}
              <text x={cx} y={T + PLOT_H + 22} textAnchor="middle" fontSize={12} fontWeight={500} fill={AXIS}>{monthTick(m)}</text>
              <text x={cx} y={T + PLOT_H + 38} textAnchor="middle" fontSize={12} fontWeight={500} fill={AXIS}>{monthYear(m)}</text>
            </g>
          );
        })}
      </svg>
      {active !== null && values[active] > 0 && (
        <ChartTip left={`${((L + colW * (active + 0.5)) / W) * 100}%`} top={`${(y(values[active]) / (H + 16)) * 100}%`} flip={(L + colW * (active + 0.5)) / W > 0.6} title={monthTitle(months[active])}>
          <span className="flex justify-between gap-6 text-[var(--color-accent-400)]">
            <span className="text-[12px] font-medium">Projects:</span><span className="text-[14px] font-semibold">{values[active]}</span>
          </span>
        </ChartTip>
      )}
    </div>
  );
}

/** Figma "Installer assignments per month by branch": one smooth shaded line per branch. */
function BranchAreas({ months, series }: { months: string[]; series: { key: string; color: string; values: number[] }[] }) {
  const W = 1002, H = 266, L = 44, T = 20, PLOT_H = 220;
  const { step, top } = axisTop(Math.max(0, ...series.flatMap(s => s.values)));
  const span = Math.max(1, months.length - 1);
  const PAD = 22; // room for the first / last month label
  const colStep = (W - L - PAD * 2) / span;
  const x = (i: number) => L + PAD + colStep * i;
  const y = (v: number) => T + PLOT_H * (1 - v / top);
  const [hover, setHover] = React.useState<number | null>(null);
  const uid = React.useId().replace(/:/g, '');

  const path = (vals: number[]) => {
    const pts = vals.map((v, i) => [x(i), y(v)] as const);
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const mx = (x0 + x1) / 2;
      d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    return d;
  };
  // Biggest series first so the smaller ones stay visible on top.
  const ordered = [...series].sort((a, b) => b.values.reduce((n, v) => n + v, 0) - a.values.reduce((n, v) => n + v, 0));
  const empty = series.every(s => s.values.every(v => !v));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full">
        <svg viewBox={`0 0 ${W} ${H + 16}`} className="block h-auto w-full" role="img" aria-label="Installer assignments per month by branch"
          onMouseLeave={() => setHover(null)}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {Array.from({ length: top / step + 1 }, (_, k) => k * step).map(v => (
            <g key={v}>
              <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--ui-divider)" strokeOpacity={0.65} />
              <text x={L - 12} y={y(v) + 4} textAnchor="end" fontSize={12} fontWeight={500} fill={AXIS}>{v}</text>
            </g>
          ))}
          {months.map((m, i) => (
            <g key={m}>
              <line x1={x(i)} x2={x(i)} y1={T} y2={T + PLOT_H} stroke="var(--ui-divider)" strokeOpacity={0.6} strokeDasharray="3 4" />
              <text x={x(i)} y={T + PLOT_H + 22} textAnchor="middle" fontSize={12} fontWeight={500} fill={AXIS}>{monthTick(m)}</text>
              <text x={x(i)} y={T + PLOT_H + 38} textAnchor="middle" fontSize={12} fontWeight={500} fill={AXIS}>{monthYear(m)}</text>
            </g>
          ))}
          {!empty && ordered.map(s => {
            const d = path(s.values);
            return (
              <g key={s.key}>
                <path d={`${d} L${x(s.values.length - 1)},${T + PLOT_H} L${x(0)},${T + PLOT_H} Z`} fill={`url(#${uid}-${s.key})`} />
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} />
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + PLOT_H} stroke="var(--ui-text-secondary)" />
              {series.map(s => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={3.5} fill="var(--ui-page-bg)" stroke={s.color} strokeWidth={1.5} />)}
            </g>
          )}
          {months.map((m, i) => (
            <rect key={m} x={x(i) - colStep / 2} y={T} width={colStep} height={PLOT_H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {hover !== null && (
          <ChartTip left={`${(x(hover) / W) * 100}%`} top="30%" flip={x(hover) / W > 0.6} title={monthTitle(months[hover])}>
            {series.map(s => (
              <span key={s.key} className="flex items-center justify-between gap-6">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ui-body">
                  <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />{s.key}
                </span>
                <span className={cn('text-[14px] font-semibold', HEADING)}>{s.values[hover]}</span>
              </span>
            ))}
          </ChartTip>
        )}
        {empty && <p className="absolute inset-0 m-0 flex items-center justify-center text-[13px] text-ui-text-secondary">No installer assignments in this period.</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-[12px] font-medium">
        {series.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-ui-body">
            <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />{s.key}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Sits right of the point; `flip` puts it on the left so it never runs off the card. */
function ChartTip({ left, top, title, flip, children }: { left: string; top: string; title: string; flip?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('pointer-events-none absolute z-[1] flex w-[146px] flex-col gap-2 rounded-[6px] border border-ui-divider bg-ui-page-bg p-3 shadow-sm',
      flip ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3')}
      style={{ left, top }}>
      <span className={cn('text-[12px] font-medium leading-4', HEADING)}>{title}</span>
      <span className="flex flex-col leading-4">{children}</span>
    </div>
  );
}

// ── shared with the Monthly and Team Allocation tabs ──────────────────────────────────────────
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-[6px] border border-ui-divider">
      <table className="w-full border-collapse">
        <thead><tr>{head.map(h => <th key={h} className={TH}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
