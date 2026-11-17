'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpFromDot, Award, CircleCheck, ClipboardCheck, Cog, DraftingCompass, Hammer, Loader, MessagesSquare, Ship,
  UsersRound, ZoomIn, ZoomOut, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BRANCHES, addDays, alertOf, type Branch, type Clash, type Installation,
} from '@/lib/installations/compute';
import {
  LIFE_STAGE, UNDATED_STAGE, currentStage, lifecycleSegments,
  type LifeSegment, type LifeStage, type ProjectMilestones, type UndatedStage,
} from '@/lib/installations/lifecycle';
import { projectNumber } from '@/lib/keyClients/match';
import { HEADING, SCOPE_COLOR } from './shared';

// Shown on /dashboard → "View as Gantt chart" (DashboardGantt). It used to be the Gantt tab of
// /tlines-pm/installation, which now has its own simpler chart (GanttTab, Figma 651:31965).
// Figma 784:18261 — Gantt chart: a project list on the left (number chip, store, region, dates,
// assignee, current stage) tinted in the project's current stage colour, and on the right one
// 300px column per month (dashed lines split it into weeks) with the project's life drawn as dated
// stages — a dark chip at the start of each stage. Only stages with real dates are drawn
// (lib/installations/lifecycle). Overdue / double-booked installs are outlined red, tentative
// ones striped, and an accent line marks today.
// Month width in px. Ctrl + wheel / pinch / Ctrl +/- over the chart (or the -/+ buttons) zooms the
// timeline only, never the page: 60px fits years on screen, 900px shows single days.
const MONTH_W = 300;
const MONTH_W_MIN = 60;
const MONTH_W_MAX = 900;
const clampMonthW = (w: number) => Math.min(MONTH_W_MAX, Math.max(MONTH_W_MIN, Math.round(w)));
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
// Figma 818:11574: store, dates and assignee text start at the cell edge (right padding only).
const FLUSH = new Set<string>(['name', 'dates', 'assignee']);

const fg = (s: LifeStage) => `var(--board-${LIFE_STAGE[s].tone}-fg)`;
const bg = (s: LifeStage) => `var(--board-${LIFE_STAGE[s].tone}-bg)`;

const UNDATED_ICON: Record<UndatedStage, LucideIcon> = {
  queued: Loader, initial_meeting: UsersRound, initial_design: DraftingCompass, proposal: DraftingCompass,
  negotiation: MessagesSquare, finalization: DraftingCompass, technical: Cog, to_production: ArrowUpFromDot,
};
interface RowStatus { label: string; fg: string; bg: string; Icon: LucideIcon }
/**
 * The row's status (Figma 811:12864): the dated stage, unless the project is still before
 * production — then the undated stage it is in (sales stage / Trust board) is more precise.
 */
function rowStatus(dated: LifeStage | null, undated: UndatedStage | null): RowStatus | null {
  if (undated && (!dated || dated === 'opportunity')) {
    const t = UNDATED_STAGE[undated].tone;
    return { label: UNDATED_STAGE[undated].label, fg: `var(--${t}-fg)`, bg: `var(--${t}-bg)`, Icon: UNDATED_ICON[undated] };
  }
  return dated ? { label: LIFE_STAGE[dated].label, fg: fg(dated), bg: bg(dated), Icon: STAGE_ICON[dated] } : null;
}

const daysIn = (key: string) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 0)).getUTCDate();
const monthHead = (key: string) =>
  new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).toUpperCase();
/** "AUG" */
const monthShort = (key: string) =>
  new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
type ScaleLevel = 'months' | 'quarters' | 'days';
interface Tick { key: string; label: string; title?: string; x: number; w: number; today?: boolean }
/** Faint day lines inside a month column (one every `w` px), drawn in the column's text colour. */
const dayLines = (w: number) =>
  `repeating-linear-gradient(to right, transparent 0 ${w - 1}px, color-mix(in srgb, currentColor 35%, transparent) ${w - 1}px ${w}px)`;
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

export function LifecycleGantt({ rows, months: planMonths, today, clashes, projectByNo, milestonesByNo, undatedByNo = {}, onOpen }: {
  rows: Installation[]; months: string[]; today: string; clashes: Map<string, Clash[]>; projectByNo: Record<string, string>;
  milestonesByNo: Record<string, ProjectMilestones>;
  undatedByNo?: Record<string, UndatedStage>;
  /** A row click opens the board's popup for the project; false = no card, go to the project page. */
  onOpen?: (projectNo: string) => boolean;
}) {
  const router = useRouter();
  const [colorBy, setColorBy] = React.useState<ColorBy>('branch');
  const [monthW, setMonthW] = React.useState(MONTH_W);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const hoverRef = React.useRef(false);

  /** Zoom the timeline by `factor`, keeping the date under `clientX` (else the middle) in place. */
  const zoom = React.useCallback((factor: number | 'reset', clientX?: number) => {
    const el = scrollRef.current;
    setMonthW(prev => {
      const next = factor === 'reset' ? MONTH_W : clampMonthW(prev * factor);
      if (el && next !== prev) {
        const rect = el.getBoundingClientRect();
        const px = (clientX ?? rect.left + LEFT_W + (rect.width - LEFT_W) / 2) - rect.left - LEFT_W;
        const at = Math.max(0, el.scrollLeft + px) / prev;   // in months from the chart start
        requestAnimationFrame(() => { el.scrollLeft = at * next - px; });
      }
      return next;
    });
  }, []);

  // Ctrl + wheel and trackpad pinch (sent as Ctrl + wheel) over the chart, and Ctrl +/-/0 while the
  // pointer is on it, zoom the timeline instead of the browser page.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        // Scrolling down over the chart first brings it up to the top bar (full screen, its
        // horizontal scrollbar at the screen bottom); only then does the chart itself scroll.
        if (e.deltaY > 0 && !e.shiftKey) {
          const topBar = document.querySelector('[data-shell="topbar"]')?.getBoundingClientRect().bottom ?? 0;
          const gap = el.getBoundingClientRect().top - topBar;
          if (gap > 1) {
            e.preventDefault();
            window.scrollBy({ top: Math.min(gap, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) });
          }
        }
        return;
      }
      e.preventDefault();
      zoom(Math.exp(-e.deltaY * 0.002), e.clientX);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!hoverRef.current || !(e.ctrlKey || e.metaKey)) return;
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoom(1 / 1.25); }
      else if (e.key === '=' || e.key === '+') { e.preventDefault(); zoom(1.25); }
      else if (e.key === '0') { e.preventDefault(); zoom('reset'); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey); };
  }, [zoom]);

  const lives = React.useMemo(() => rows.map(r => {
    const no = projectNumber(r.project_no);
    const segments = lifecycleSegments(no ? milestonesByNo[no] ?? null : null, r, today);
    return { row: r, segments, status: rowStatus(currentStage(segments, today), no ? undatedByNo[no] ?? null : null) };
  }), [rows, milestonesByNo, undatedByNo, today]);

  // The plan's months, widened to every drawn stage (production often starts months earlier).
  const dataMonths = React.useMemo(() => {
    const ds = lives.flatMap(l => l.segments.flatMap(s => [s.start, s.end]));
    const lo = [planMonths[0] ? `${planMonths[0]}-01` : null, ...ds].filter((x): x is string => !!x).sort()[0];
    const hi = [planMonths.at(-1) ? `${planMonths.at(-1)}-01` : null, ...ds].filter((x): x is string => !!x).sort().at(-1);
    return lo && hi ? monthsBetween(lo, hi) : planMonths;
  }, [lives, planMonths]);

  // The calendar never stops short of the chart's right edge: zoomed out, later months are added
  // until the timeline fills the visible width.
  const [viewW, setViewW] = React.useState(0);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const months = React.useMemo(() => {
    const need = Math.ceil((viewW - LEFT_W) / monthW);
    const first = dataMonths[0];
    if (!first || dataMonths.length >= need) return dataMonths;
    const out = [...dataMonths];
    while (out.length < need) {
      const [y, m] = out[out.length - 1].split('-').map(Number);
      out.push(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`);
    }
    return out;
  }, [dataMonths, viewW, monthW]);

  const first = months[0];
  const last = months[months.length - 1];
  const start = first ? `${first}-01` : today;
  const end = last ? `${last}-${String(daysIn(last)).padStart(2, '0')}` : today;
  const timelineW = months.length * monthW;

  /** x of the start of a day (yyyy-mm-dd) on the timeline, clamped to the chart. */
  const dayX = (iso: string) => {
    if (iso < start) return 0;
    if (iso > end) return timelineW;
    const key = iso.slice(0, 7);
    const i = months.indexOf(key);
    if (i < 0) return iso < start ? 0 : timelineW;
    return i * monthW + ((+iso.slice(8, 10) - 1) / daysIn(key)) * monthW;
  };
  const todayX = today >= start && today <= end ? dayX(today) : null;

  // The header's intervals follow the zoom: zoomed out → years over months; normal → months over
  // quarters of a month ("1–8", "9–15" …); zoomed in → months over single days.
  const scale = React.useMemo(() => {
    const level: ScaleLevel = monthW < 120 ? 'months' : monthW < 450 ? 'quarters' : 'days';
    const top: Tick[] = [];
    const bottom: Tick[] = [];
    months.forEach((m, i) => {
      const x0 = i * monthW;
      const days = daysIn(m);
      if (level === 'months') {
        const y = m.slice(0, 4);
        const last = top.at(-1);
        if (last?.key === y) last.w += monthW;
        else top.push({ key: y, label: y, x: x0, w: monthW });
        const short = monthShort(m);
        bottom.push({ key: m, label: monthW >= 40 ? short : short[0], title: monthHead(m), x: x0, w: monthW, today: today.slice(0, 7) === m });
        return;
      }
      top.push({ key: m, label: monthHead(m), x: x0, w: monthW });
      if (level === 'quarters') {
        for (let q = 0; q < 4; q++) {
          const a = Math.round((q * days) / 4) + 1, b = Math.round(((q + 1) * days) / 4);
          const inIt = today.slice(0, 7) === m && +today.slice(8, 10) >= a && +today.slice(8, 10) <= b;
          bottom.push({ key: `${m}-${q}`, label: monthW >= 200 ? `${a}–${b}` : String(a), title: `${a}–${b} ${monthHead(m)}`, x: x0 + (q * monthW) / 4, w: monthW / 4, today: inIt });
        }
      } else {
        for (let d = 1; d <= days; d++) {
          const iso = `${m}-${String(d).padStart(2, '0')}`;
          bottom.push({ key: iso, label: String(d), title: dayMonth(iso), x: x0 + ((d - 1) * monthW) / days, w: monthW / days, today: iso === today });
        }
      }
    });
    return { level, top, bottom };
  }, [months, monthW, today]);
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
        <div className="ml-auto flex h-9 items-center rounded-[6px] border border-ui-body" role="group" aria-label="Timeline zoom">
          <button type="button" onClick={() => zoom(1 / 1.25)} disabled={monthW <= MONTH_W_MIN} aria-label="Zoom out the timeline"
            title="Zoom out (Ctrl + scroll / Ctrl -)" className="inline-flex h-full cursor-pointer items-center px-2.5 text-ui-body hover:text-ui-heading disabled:cursor-default disabled:opacity-40">
            <ZoomOut size={16} aria-hidden />
          </button>
          <button type="button" onClick={() => zoom('reset')} title="Reset zoom (Ctrl 0)"
            className="h-full min-w-[52px] cursor-pointer border-x border-ui-body px-2 text-[12px] font-semibold tabular-nums text-ui-body hover:text-ui-heading">
            {Math.round((monthW / MONTH_W) * 100)}%
          </button>
          <button type="button" onClick={() => zoom(1.25)} disabled={monthW >= MONTH_W_MAX} aria-label="Zoom in the timeline"
            title="Zoom in (Ctrl + scroll / Ctrl +)" className="inline-flex h-full cursor-pointer items-center px-2.5 text-ui-body hover:text-ui-heading disabled:cursor-default disabled:opacity-40">
            <ZoomIn size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div ref={scrollRef} onMouseEnter={() => { hoverRef.current = true; }} onMouseLeave={() => { hoverRef.current = false; }}
        // As tall as the page under the top bar (80px): scrolled up to it, the chart fills the screen.
        className="max-h-[calc(100dvh-96px)] min-h-[320px] overflow-auto rounded-[8px] border border-ui-divider bg-ui-page-bg">
        <div style={{ width: LEFT_W + timelineW }}>
          {/* header */}
          <div className="sticky top-0 z-[3] flex h-[46px] border-b border-ui-divider bg-ui-surface">
            <div className="sticky left-0 z-[4] flex border-r border-ui-body bg-ui-surface" style={{ width: LEFT_W }}>
              {LEFT.map((c, i) => (
                <div key={c.key} className={cn('flex items-center px-2 text-[12px] font-semibold leading-[1.4] text-ui-body', i === 0 && 'pl-4', FLUSH.has(c.key) && 'pl-0')} style={{ width: c.w }}>
                  {c.label}
                </div>
              ))}
            </div>
            {/* Two rows that follow the zoom: years / months, months / quarters of a month, months / days */}
            <div className="relative shrink-0" style={{ width: timelineW }}>
              <div className="absolute inset-x-0 top-0 h-[25px]">
                {scale.top.map(t => (
                  <div key={t.key} className={cn('absolute top-0 flex h-full items-center justify-center overflow-hidden whitespace-nowrap border-r border-ui-divider text-[14px] font-semibold leading-none', HEADING)}
                    style={{ left: t.x, width: t.w }}>{t.label}</div>
                ))}
              </div>
              <div className="absolute inset-x-0 bottom-0 h-5 border-t border-ui-divider">
                {scale.bottom.map(t => (
                  <div key={t.key} title={t.title} className={cn('absolute top-0 flex h-full items-center justify-center overflow-hidden whitespace-nowrap border-r border-ui-divider text-[11px] font-medium leading-none',
                    t.today ? 'bg-[var(--color-accent-500,#E63700)] text-white' : 'text-ui-body')}
                    style={{ left: t.x, width: t.w }}>{t.label}</div>
                ))}
              </div>
            </div>
          </div>

          {/* rows */}
          {lives.map(({ row: r, segments, status }) => {
            const s = r.planned_start, f = r.planned_finish ?? r.planned_start;
            const alert = alertOf(r, today);
            const red = !!alert?.text.startsWith('Overdue') || clashes.has(r.id);
            const tentative = r.confidence === 'Tentative';
            const tint = status?.bg;
            const ink = status?.fg;
            const no = projectNumber(r.project_no);
            const projectId = no ? projectByNo[no] : undefined;
            const openRow = () => {
              if (r.project_no && onOpen?.(r.project_no)) return;
              if (projectId) router.push(`/projects/${projectId}`);
            };
            return (
              <div key={r.id} className={cn('flex border-b border-ui-divider', onOpen && 'cursor-pointer hover:brightness-[0.97]')} style={{ height: ROW_H }}
                {...(onOpen ? {
                  role: 'button', tabIndex: 0, 'aria-label': `Open ${r.project_no ?? ''} ${r.project_name ?? ''}`,
                  onClick: openRow,
                  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(); } },
                } : {})}>
                {/* Figma 818:11615 — the row in its current stage's tint, text in the stage colour */}
                <div className={cn('sticky left-0 z-[2] flex items-center border-r border-ui-body', !status && 'bg-ui-page-bg')}
                  style={{ width: LEFT_W, background: tint, color: ink }}>
                  <Cell w={LEFT[0].w} className="px-2">
                    <ProjectChip text={r.project_no || '—'} href={!onOpen && projectId ? `/projects/${projectId}` : null} status={status} />
                  </Cell>
                  <Cell w={LEFT[1].w} className={cn('pl-0 font-semibold', !status && HEADING)} title={r.project_name ?? undefined}>{r.project_name || '—'}</Cell>
                  <Cell w={LEFT[2].w}>
                    {r.branch
                      ? <span className="inline-flex h-[21px] w-[43px] items-center justify-center rounded-[2px] text-[16px] font-medium leading-4 text-white" style={{ background: REGION[r.branch].color }} title={r.branch}>{REGION[r.branch].label}</span>
                      : <span className="opacity-60">—</span>}
                  </Cell>
                  <Cell w={LEFT[3].w} className={cn('pl-0 text-[14px] font-medium', !status && HEADING)}>{s ? `${dayMonth(s)} - ${dayMonth(f!)}` : '—'}</Cell>
                  <Cell w={LEFT[4].w} className={cn('pl-0 text-[14px] font-medium', !status && HEADING)} title={r.pm_name ?? r.team ?? undefined}>
                    {r.pm_name || r.team || <span className="opacity-60">TBD</span>}
                  </Cell>
                  <Cell w={LEFT[5].w} className="gap-1 text-[12px] font-medium leading-4">
                    {status
                      ? <><status.Icon size={14} aria-hidden className="shrink-0" /><span className="truncate" title={status.label}>{status.label}</span></>
                      : <span className="text-ui-text-secondary">No dates yet</span>}
                  </Cell>
                </div>

                <div className="relative shrink-0" style={{ width: timelineW, background: tint }}>
                  {/* month columns, dashed weeks */}
                  <div className="absolute inset-0 flex" aria-hidden>
                    {months.map(m => (
                      <div key={m} className="flex h-full shrink-0 border-r border-ui-text-secondary text-ui-text-secondary" style={{ width: monthW, backgroundImage: scale.level === 'days' ? dayLines(monthW / daysIn(m)) : undefined }}>
                        {/* the same split as the header's lower row */}
                        {scale.level === 'quarters' && [0, 1, 2, 3].map(q => <div key={q} className={cn('h-full flex-1', q < 3 && 'border-r border-dashed border-ui-text-secondary')} />)}
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
  const label = LIFE_STAGE[seg.stage].label;
  const Icon = STAGE_ICON[seg.stage];
  const full = x1 - x0 >= chipWidth(label) + 8;
  // Figma 811:13079: a stage too short for its chip is a 36px square with just the stage icon.
  const w = full ? x1 - x0 : Math.max(36, x1 - x0);
  const fill = install
    ? (install.tentative
      ? `repeating-linear-gradient(135deg, color-mix(in srgb, ${install.color} 55%, transparent) 0 5px, color-mix(in srgb, ${install.color} 20%, transparent) 5px 10px)`
      : `color-mix(in srgb, ${install.color} 35%, transparent)`)
    : bg(seg.stage);
  // Figma 811:12864: Completed is no span, just an outlined chip right after the installation.
  if (seg.stage === 'completed') {
    return (
      <span
        title={title}
        className="absolute top-1/2 inline-flex h-6 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-[4px] border pl-2 pr-3 text-[12px] font-medium leading-4"
        style={{ left: x1 + 11, background: bg(seg.stage), borderColor: fg(seg.stage), color: fg(seg.stage) }}
      >
        <Icon size={14} aria-hidden className="shrink-0" />
        {label}
      </span>
    );
  }
  return (
    <div
      title={title}
      // Figma 811:12864: the labelled chip sits in the middle of its stage box.
      className={cn('absolute top-1/2 flex h-9 -translate-y-1/2 items-center rounded-[4px] border', full && 'justify-center', seg.open && 'border-dashed', install?.red && 'border-[1.5px]')}
      style={{
        left: x0, width: w, background: fill,
        // Figma 811:12702: box in the stage's light tone, outlined in its dark tone.
        borderColor: install?.red ? 'var(--color-error-normal)' : fg(seg.stage),
      }}
    >
      {full ? (
        <span
          className="inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] pl-2 pr-3 text-[12px] font-medium leading-4"
          style={{ background: fg(seg.stage), color: bg(seg.stage) }}
        >
          <Icon size={14} aria-hidden className="shrink-0" />
          {label}
        </span>
      ) : (
        <span className="ml-[7px] inline-flex shrink-0" style={{ color: fg(seg.stage) }}>
          <Icon size={20} aria-hidden />
          <span className="sr-only">{label}</span>
        </span>
      )}
    </div>
  );
}

function ProjectChip({ text, href, status }: { text: string; href: string | null; status: RowStatus | null }) {
  const cls = 'inline-flex max-w-full items-center justify-center truncate rounded-[4px] px-4 py-2 text-[16px] font-medium leading-4 no-underline';
  const style = status ? { background: status.fg, color: status.bg } : undefined;
  const plain = !status && 'bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950';
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
