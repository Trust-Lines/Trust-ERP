'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, CircleCheck, ClipboardList, ClipboardPenLine,
  Drill, ExternalLink, Factory, FolderClosed, ListChecks, Ship, UserRound,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { regionLogoByCode, shellLogo } from '@/lib/regionLogo';
import { byUrgency, isOpen, isOverdue, todayKey, SOURCE_LABEL, type MyTask, type MyTaskStatus } from '@/lib/myWorkspace/taskTypes';
import type { MyApproval } from '@/lib/approvals/mine';
import type { Installation } from '@/lib/installations/compute';
import { cn } from '@/lib/utils';

// My Workspace → Overview, Figma "General Manager_Dashboard" (node 714:35213).
// Every number comes from data the person can already open; a panel whose source this role
// can't read is left out instead of showing an empty or made-up list.
//   projects, design docs   the page (the person's RLS client)
//   My Tasks                GET /api/my-workspace/tasks (status saved like My Tasks does)
//   PO / PF to sign         GET /api/approvals/mine
//   Containers              GET /api/containers
//   Installation            GET /api/installations
//   Clients opportunity     GET /api/tlines-dashboard/client-opportunities

export interface DashProject {
  id: string; code: string; name: string; region: string | null; current_stage: string;
  categories: string[] | null; site_location: string | null; created_at: string;
  closed_deal_date: string | null; est_production_start: string | null;
}
export interface DesignDoc { id: string; project_id: string; file_name: string; file_size_bytes: number | null; created_at: string }
interface Container { id: string; container_no: string | null; estimated_arrival_date: string | null; status: string; item_count: number }
type Loaded<T> = T[] | 'denied' | 'error' | null;

const REGIONS = [
  { key: 'NE', code: 'TLINES_NE', label: 'T-Lines North East', color: '#465B6D' },
  { key: 'SE', code: 'TLINES_SE', label: 'T-Lines South East', color: '#3B472B' },
  { key: 'NW', code: 'TLINES_NW', label: 'T-Lines North West', color: '#2E5BA3' },
  { key: 'CVW', code: 'CVW', label: 'CVW T-Lines', color: '#7A655E' },
] as const;
type RegionKey = (typeof REGIONS)[number]['key'];
const regionOf = (code: string | null) => REGIONS.find(r => r.code === code || r.key === code)?.key ?? null;

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'rounded-[16px] border border-ui-divider bg-ui-surface-elevated';
const MON = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const STATUS_LABEL: Record<MyTaskStatus, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const STATUS_TONE: Record<MyTaskStatus, string> = { todo: 't2', in_progress: 't7', done: 't9' };

// ── dates ──────────────────────────────────────────────────────────────────────────────────────
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDay = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d: Date) => `${d.getDate()} ${MON.format(d)} ${d.getFullYear()}`;
const PRESETS = [
  { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' }, { value: 'year', label: 'This year' },
];
function presetRange(p: string, now = new Date()): [Date, Date] {
  const t = dayStart(now);
  if (p === 'week') { const s = new Date(t); s.setDate(t.getDate() - ((t.getDay() + 6) % 7)); const e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; }
  if (p === 'month') return [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)];
  if (p === 'quarter') { const q = Math.floor(t.getMonth() / 3) * 3; return [new Date(t.getFullYear(), q, 1), new Date(t.getFullYear(), q + 3, 0)]; }
  return [new Date(t.getFullYear(), 0, 1), new Date(t.getFullYear(), 11, 31)];
}
/** Month buckets covering [from, to] (at least one). */
function monthsBetween(from: Date, to: Date) {
  const out: { key: string; mon: string; year: number }[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  while (d <= to && out.length < 36) {
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, mon: MON.format(d).toUpperCase(), year: d.getFullYear() });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}
const monthKey = (s: string) => { const d = parseDay(s); return `${d.getFullYear()}-${d.getMonth()}`; };
const inRange = (s: string | null, from: Date, to: Date) => { if (!s) return false; const d = parseDay(s); return d >= from && d <= to; };
const startOf = (p: DashProject) => p.est_production_start ?? p.created_at;
const fileSize = (b: number | null) => (b == null ? '' : b >= 1048576 ? `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1)} mb` : `${Math.max(1, Math.round(b / 1024))} kb`);


async function getList<T>(url: string, pick: (b: Record<string, unknown>) => T[]): Promise<Loaded<T>> {
  const res = await fetch(url).catch(() => null);
  if (res && (res.status === 401 || res.status === 403)) return 'denied';
  if (!res?.ok) return 'error';
  const body = await res.json().catch(() => null);
  return body ? pick(body) : 'error';
}

// ── small parts ────────────────────────────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  const w = 92, h = 38;
  const pts = values.map((v, i) => [values.length < 2 ? w / 2 : (i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 overflow-visible">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.45" /><stop offset="1" stopColor={color} stopOpacity="0.04" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** `color` is the tone's text colour, `onColor` the text on a `color` fill (Figma: the tone's own
 *  background), so the "+N New" badge reads as a dark-on-pale chip in dark mode (node 714:36443). */
function Kpi({ label, value, icon, sub, badge, color, onColor, spark, href }: {
  label: string; value: ReactNode; icon: ReactNode; sub: string; badge?: string; color: string; onColor: string; spark: number[]; href?: string;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium uppercase leading-[1.5] tracking-[-0.264px]" style={{ color }}>{label}</span>
        {badge && <span className="inline-flex h-[18px] items-center rounded-[4px] px-2 text-[10px] font-medium tracking-[0.4px]" style={{ background: color, color: onColor }}>{badge}</span>}
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-2">
          <span className="flex items-center gap-1 text-[36px] font-semibold leading-none tracking-[0.72px] [&_svg]:size-[29px]" style={{ color }}>
            <span className="tabular-nums">{value}</span>{icon}
          </span>
          <span className="text-[10px] leading-[1.5] tracking-[-0.22px] opacity-50" style={{ color }}>{sub}</span>
        </span>
        <Sparkline values={spark} color={color} />
      </span>
    </>
  );
  const cls = cn(CARD, 'flex min-w-0 flex-col gap-2 py-3.5 pl-4 pr-4 no-underline');
  return href
    ? <Link href={href} className={cn(cls, 'transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-visible:outline-2 focus-visible:outline-ui-focus-ring')}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

/** Figma list card (Containers / PO / PF / In Production / Installation / Design folders). */
function ListCard({ title, icon, color, href, state, emptyText, children }: {
  title: string; icon: ReactNode; color: string; href: string;
  state: 'loading' | 'error' | 'empty' | 'ready'; emptyText: string; children?: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn(CARD, 'flex min-w-0 flex-col pb-5 pt-3')}>
      <header className="flex items-center gap-2 border-b border-ui-divider px-5 pb-3" style={{ color }}>
        <span className="[&_svg]:size-[25px]" aria-hidden>{icon}</span>
        <h2 className="m-0 min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[0.4px]">{title}</h2>
        <Link href={href} className="inline-flex h-9 shrink-0 items-center rounded-[6px] border border-current bg-ui-surface-elevated px-2 text-[13px] font-medium no-underline transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring">
          View All<span className="sr-only">: {title}</span>
        </Link>
      </header>
      <div className="flex flex-col px-4 pt-2.5">
        {state === 'loading' && <p role="status" className="m-0 py-6 text-center text-[13px] text-ui-text-secondary">Loading…</p>}
        {state === 'error' && <p role="alert" className="m-0 py-6 text-center text-[13px] text-ui-text-secondary">Couldn’t load {title.toLowerCase()}. Refresh to try again.</p>}
        {state === 'empty' && <p className="m-0 py-6 text-center text-[13px] text-ui-text-secondary">{emptyText}</p>}
        {state === 'ready' && children}
      </div>
    </section>
  );
}

function Row({ lead, title, sub, color, right, href, action = 'arrow', label }: {
  lead: ReactNode; title: string; sub: string; color: string; right?: ReactNode; href: string;
  action?: 'arrow' | 'none'; label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ui-divider py-2.5 pr-2 last:border-b-0" style={{ color }}>
      <span className="flex min-w-0 items-center gap-2.5">
        {lead}
        <span className="flex min-w-0 flex-col leading-normal">
          <span className="truncate text-[14px] font-semibold tracking-[-0.308px]">{title}</span>
          <span className="truncate text-[12px] tracking-[-0.264px] opacity-75">{sub}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-4">
        {right}
        {action === 'arrow' && (
          <Link href={href} aria-label={label} className="inline-flex size-[35px] items-center justify-center rounded-[6px] border border-current bg-ui-surface-elevated no-underline transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring" style={{ color }}>
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        )}
      </span>
    </div>
  );
}

const CodeChip = ({ t, children }: { t: string; children: ReactNode }) => (
  <span className="inline-flex h-[35px] shrink-0 items-center rounded-[6px] px-2.5 text-[14px] font-semibold tracking-[-0.308px]" style={{ background: `var(--status-${t}-bg)`, color: `var(--status-${t}-fg)` }}>{children}</span>
);
const Pill = ({ solid, color, children }: { solid?: boolean; color: string; children: ReactNode }) => (
  <span className={cn('inline-flex h-[22px] items-center rounded-[4px] px-2.5 text-[12px] leading-[1.4]', solid ? 'text-white' : 'border border-current')}
    style={solid ? { background: color } : { color }}>{children}</span>
);
const state = <T,>(d: Loaded<T> | T[] | null, n: number) => (d === null ? 'loading' : d === 'error' ? 'error' : n === 0 ? 'empty' : 'ready');

// ── charts ─────────────────────────────────────────────────────────────────────────────────────
function niceMax(v: number) { const step = v <= 4 ? 1 : v <= 20 ? 5 : v <= 40 ? 10 : Math.ceil(v / 40) * 10; return Math.max(step * 4, Math.ceil(v / step) * step); }

function Axis({ max, children, months, height = 220 }: { max: number; children: ReactNode; months: { key: string; mon: string; year: number }[]; height?: number }) {
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i);
  return (
    <div className="flex gap-3">
      <div className="relative w-8 shrink-0" style={{ height }} aria-hidden>
        {ticks.map(t => <span key={t} className="absolute right-0 translate-y-1/2 text-[12px] font-medium leading-4 text-ui-text-secondary" style={{ bottom: `${(t / max) * 100}%` }}>{Math.round(t)}</span>)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map(t => <div key={t} aria-hidden className="absolute inset-x-0 h-px bg-ui-divider opacity-65" style={{ bottom: `${(t / max) * 100}%` }} />)}
          {children}
        </div>
        <div className="mt-2 flex" aria-hidden>
          {months.map(m => <span key={m.key} className="flex-1 text-center text-[12px] font-medium leading-4 text-ui-text-secondary">{m.mon}<br />{m.year}</span>)}
        </div>
      </div>
    </div>
  );
}

function BarChart({ months, counts }: { months: { key: string; mon: string; year: number }[]; counts: number[] }) {
  const max = niceMax(Math.max(0, ...counts));
  return (
    <Axis max={max} months={months}>
      <div className="absolute inset-0 flex">
        {months.map((m, i) => (
          <div key={m.key} className="flex flex-1 justify-center">
            <div className="relative h-full w-[min(31px,70%)] bg-ui-divider/50">
              <div className="absolute inset-x-0 bottom-0 rounded-t-[6px] bg-ui-btn-accent" style={{ height: `${(counts[i] / max) * 100}%` }} title={`${m.mon} ${m.year}: ${counts[i]}`} />
            </div>
          </div>
        ))}
      </div>
    </Axis>
  );
}

function smooth(pts: [number, number][]) {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

function AreaChart({ months, series }: { months: { key: string; mon: string; year: number }[]; series: { key: RegionKey; label: string; color: string; values: number[] }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...series.flatMap(s => s.values)));
  const W = 1000, H = 220, n = months.length;
  const x = (i: number) => (n < 2 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  return (
    <Axis max={max} months={months}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.55" /><stop offset="1" stopColor={s.color} stopOpacity="0.05" />
            </linearGradient>
          ))}
        </defs>
        {series.map(s => {
          const line = smooth(s.values.map((v, i) => [x(i), y(v)]));
          return (
            <g key={s.key}>
              <path d={`${line} L${x(n - 1)},${H} L${x(0)},${H} Z`} fill={`url(#area-${s.key})`} />
              <path d={line} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="var(--ui-text-secondary)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="absolute inset-0 flex">
        {months.map((m, i) => (
          <div key={m.key} className="relative flex-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div role="tooltip" className={cn('pointer-events-none absolute top-1/3 z-10 w-max min-w-[120px] rounded-[6px] border border-ui-divider bg-ui-surface-elevated px-2.5 py-2 text-[11px] shadow-[0_4px_16px_rgba(0,0,0,0.10)]', i > n / 2 ? 'right-1/2' : 'left-1/2')}>
                <p className="m-0 font-medium text-ui-heading">{m.mon} {m.year}</p>
                {series.map(s => (
                  <p key={s.key} className="m-0 mt-1 flex items-center justify-between gap-4 text-ui-text-secondary">
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.key}</span>
                    <span className="font-semibold text-ui-heading tabular-nums">{s.values[i]}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Axis>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────────────────────
export function WorkspaceDashboard({ userName, role, projects, designDocs, access }: {
  userName: string; role: string; projects: DashProject[] | null; designDocs: DesignDoc[] | null;
  access: { projects: boolean; production: boolean; installation: boolean; logistics: boolean; opportunities: boolean };
}) {
  const router = useRouter();
  const [preset, setPreset] = useState('year');
  const [[from, to], setRange] = useState<[Date, Date]>(() => presetRange('year'));
  const [region, setRegion] = useState<RegionKey | ''>('');
  const [regionSeries, setRegionSeries] = useState<RegionKey | ''>('');
  const [grouping, setGrouping] = useState<'month' | 'quarter'>('month');
  const [tasks, setTasks] = useState<Loaded<MyTask>>(null);
  const [approvals, setApprovals] = useState<Loaded<MyApproval>>(null);
  const [containers, setContainers] = useState<Loaded<Container>>(null);
  const [installs, setInstalls] = useState<Loaded<Installation>>(null);
  const [opportunities, setOpportunities] = useState<number | 'denied' | 'error' | null>(null);
  const [now] = useState(() => new Date());
  const [today] = useState(() => todayKey());

  useEffect(() => {
    void getList('/api/my-workspace/tasks', b => (b.tasks ?? []) as MyTask[]).then(setTasks);
    void getList('/api/approvals/mine', b => (b.approvals ?? []) as MyApproval[]).then(setApprovals);
    if (access.logistics) void getList('/api/containers', b => (b.containers ?? []) as Container[]).then(setContainers); else setContainers('denied');
    if (access.installation) void getList('/api/installations', b => (b.rows ?? []) as Installation[]).then(setInstalls); else setInstalls('denied');
    if (access.opportunities) {
      void fetch('/api/tlines-dashboard/client-opportunities').then(async r => {
        if (r.status === 401 || r.status === 403) return setOpportunities('denied');
        const b = r.ok ? await r.json().catch(() => null) : null;
        setOpportunities(b && typeof b.total === 'number' ? b.total : 'error');
      }).catch(() => setOpportunities('error'));
    } else setOpportunities('denied');
  }, [access.logistics, access.installation, access.opportunities]);

  async function toggleTask(t: MyTask, done: boolean) {
    if (!t.statusApi) return;
    const status: MyTaskStatus = done ? 'done' : 'todo';
    const follow = t.statusApi.kind === 'follow_up';
    setTasks(l => (Array.isArray(l) ? l.map(x => (x.id === t.id && x.source === t.source ? { ...x, status } : x)) : l));
    const res = await fetch(t.statusApi.url, {
      method: follow ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: follow ? (done ? 'done' : 'open') : status }),
    }).catch(() => null);
    if (!res?.ok) {
      setTasks(l => (Array.isArray(l) ? l.map(x => (x.id === t.id && x.source === t.source ? { ...x, status: t.status } : x)) : l));
      toast.error('Could not save the status');
      return;
    }
    if (done) toast.success('Task done');
    router.refresh();
  }

  // ── derived ──
  const scoped = useMemo(() => (projects ?? []).filter(p => !region || regionOf(p.region) === region), [projects, region]);
  const active = scoped.filter(p => p.current_stage !== 'delivered');
  const newInRange = scoped.filter(p => inRange(p.created_at, from, to)).length;
  const closed = scoped.filter(p => inRange(p.closed_deal_date, from, to));
  const months = useMemo(() => monthsBetween(from, to), [from, to]);
  const buckets = useMemo(() => {
    if (grouping === 'month') return months.map(m => ({ ...m, keys: [m.key] }));
    const out: { key: string; mon: string; year: number; keys: string[] }[] = [];
    for (const m of months) {
      const q = Math.floor(Number(m.key.split('-')[1]) / 3);
      const k = `${m.year}-Q${q}`;
      const last = out[out.length - 1];
      if (last?.key === k) last.keys.push(m.key); else out.push({ key: k, mon: `Q${q + 1}`, year: m.year, keys: [m.key] });
    }
    return out;
  }, [months, grouping]);
  const countBy = (list: DashProject[], keys: string[], date: (p: DashProject) => string | null) =>
    list.filter(p => { const d = date(p); return !!d && keys.includes(monthKey(d)); }).length;
  const barCounts = buckets.map(b => countBy(scoped, b.keys, startOf));
  const series = REGIONS.filter(r => !regionSeries || r.key === regionSeries).map(r => ({
    key: r.key, label: r.label, color: r.color,
    values: months.map(m => countBy((projects ?? []).filter(p => regionOf(p.region) === r.key), [m.key], startOf)),
  }));
  const last6 = useMemo(() => Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return `${d.getFullYear()}-${d.getMonth()}`; }), [now]);
  const spark = (list: DashProject[], date: (p: DashProject) => string | null) => last6.map(k => countBy(list, [k], date));

  const openTasks = useMemo(() => (Array.isArray(tasks) ? tasks.filter(isOpen).sort(byUrgency) : []), [tasks]);
  const docs = Array.isArray(approvals) ? approvals : [];
  const po = docs.filter(a => a.docType === 'po_bo');
  const pf = docs.filter(a => a.docType === 'pf');
  const ageDays = (iso: string) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
  const upcoming = useMemo(() => (Array.isArray(containers) ? containers.filter(c => c.estimated_arrival_date)
    .sort((a, b) => (a.estimated_arrival_date ?? '').localeCompare(b.estimated_arrival_date ?? '')) : []), [containers]);
  const inProduction = scoped.filter(p => p.current_stage === 'production');
  const installRows = useMemo(() => (Array.isArray(installs) ? installs
    .filter(r => r.status !== 'Completed' && (!region || r.branch === region))
    .sort((a, b) => (a.planned_start ?? '9999').localeCompare(b.planned_start ?? '9999')) : []), [installs, region]);

  const greeting = now.getHours() < 12 ? 'Good Morning,' : now.getHours() < 18 ? 'Good Afternoon,' : 'Good Evening,';
  const docState = approvals === null ? null : approvals === 'denied' ? 'error' : approvals;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Heading + date range ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'My Workspace', href: '/workspace' }, { label: 'Dashboard', href: '/workspace' }]} />
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-[11px] text-ui-text-secondary">From
            <DatePicker aria-label="From date" value={from} formatValue={fmtDay} className="h-9 w-[150px]"
              onValueChange={d => { if (d) { setPreset(''); setRange([d, d > to ? d : to]); } }} />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] text-ui-text-secondary">To
            <DatePicker aria-label="To date" value={to} formatValue={fmtDay} className="h-9 w-[150px]"
              onValueChange={d => { if (d) { setPreset(''); setRange([d < from ? d : from, d]); } }} />
          </label>
          <Select aria-label="Date range" className="h-9 w-[140px]" value={preset}
            options={preset ? PRESETS : [{ value: '', label: 'Custom' }, ...PRESETS]}
            onValueChange={v => { if (v) { setPreset(v); setRange(presetRange(v)); } }} />
        </div>
      </div>

      {/* ── Region tabs ── */}
      <div className={cn(CARD, 'flex flex-wrap items-center gap-2 p-1.5')} role="group" aria-label="Region">
        {REGIONS.map(r => (
          <button key={r.key} type="button" aria-pressed={region === r.key} onClick={() => setRegion(v => (v === r.key ? '' : r.key))}
            className={cn('flex h-9 min-w-[120px] flex-1 cursor-pointer items-center justify-center rounded-[6px] border-0 transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring',
              region && region !== r.key ? 'opacity-45 hover:opacity-80' : 'hover:opacity-90', region === r.key && 'ring-2 ring-offset-2 ring-offset-ui-surface-elevated')}
            style={{ background: r.color, ['--tw-ring-color' as string]: r.color }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shellLogo(regionLogoByCode(r.key))} alt={r.label} className="h-[18px] w-auto brightness-0 invert" />
          </button>
        ))}
        <Select aria-label="Regions" className="h-9 w-[130px]" value={region}
          options={[{ value: '', label: 'Regions' }, ...REGIONS.map(r => ({ value: r.key, label: r.key }))]}
          onValueChange={v => setRegion((v ?? '') as RegionKey | '')} />
      </div>

      {/* ── Greeting + My Tasks ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,527fr)_minmax(0,1245fr)]">
        <section aria-label="Today" className="relative flex min-h-[266px] flex-col justify-between overflow-hidden rounded-[16px] bg-ui-btn-accent p-5 text-white">
          <div aria-hidden className="pointer-events-none absolute -top-16 left-[263px] flex">
            {[1, 2, 3, 4].map((n, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={n} src={`/workspace/greeting-stripe-${n}.svg`} alt="" width={126} height={326}
                className="absolute h-[322px] w-[121px] max-w-none rotate-[17.91deg] skew-x-[2.89deg]" style={{ left: i * 45, top: i * 14.5 }} />
            ))}
          </div>
          <div className="relative flex flex-col gap-2.5">
            <p className="m-0 text-[24px] font-medium leading-[1.35]">{greeting}</p>
            <div>
              <p className="m-0 truncate text-[36px] font-semibold leading-normal">{userName}</p>
              {role && <p className="m-0 text-[16px] font-medium leading-[1.35]">{roleLabel(role)}</p>}
            </div>
          </div>
          <div className="relative flex items-start gap-2.5">
            <CalendarDays className="size-[51px] shrink-0" strokeWidth={1.5} aria-hidden />
            <div>
              <p className="m-0 text-[16px] font-medium leading-[1.35]">{new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(now)}</p>
              <p className="m-0 text-[24px] font-semibold leading-normal">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)}</p>
            </div>
          </div>
        </section>

        <section aria-label="My Tasks" className={cn(CARD, 'flex min-w-0 flex-col gap-3 px-1 pb-2 pt-3')}>
          <header className="flex items-center justify-between gap-3 pl-4 pr-2">
            <span className="flex items-center gap-2">
              <h2 className={cn('m-0 text-[20px] font-semibold leading-[1.35]', HEADING)}>My Tasks</h2>
              {Array.isArray(tasks) && <span className={cn('rounded-[4px] bg-ui-surface px-[9px] py-[3px] text-[15px] font-semibold leading-[1.4]', HEADING)}>{openTasks.length}</span>}
            </span>
            <Link href="/workspace/tasks" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-[var(--color-secondary-700)] px-3 text-[13px] font-medium text-white no-underline transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring dark:bg-primary-50 dark:text-primary-950">
              View All<span className="sr-only">: tasks</span><ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </header>
          <div className="flex max-h-[216px] flex-col gap-1 overflow-y-auto px-2">
            {tasks === null && <p role="status" className="m-0 py-8 text-center text-[13px] text-ui-text-secondary">Loading…</p>}
            {(tasks === 'error' || tasks === 'denied') && <p role="alert" className="m-0 py-8 text-center text-[13px] text-ui-text-secondary">Couldn’t load your tasks. Refresh to try again.</p>}
            {Array.isArray(tasks) && openTasks.length === 0 && (
              <p className="m-0 flex items-center justify-center gap-2 py-8 text-[13px] text-ui-text-secondary"><ListChecks className="size-4" aria-hidden /> No open tasks assigned to you.</p>
            )}
            {openTasks.slice(0, 5).map(t => {
              const late = isOverdue(t, today);
              return (
                <div key={`${t.source}-${t.id}`} className="flex min-h-9 items-center gap-3 rounded-[6px] bg-ui-surface pr-5 text-[13px]">
                  <span className="flex w-12 shrink-0 justify-center">
                    <Checkbox aria-label={`Mark “${t.title}” done`} checked={t.status === 'done'} disabled={!t.statusApi}
                      onCheckedChange={v => void toggleTask(t, !!v)} />
                  </span>
                  <Link href={t.record.href} className={cn('min-w-0 flex-1 truncate no-underline hover:underline', HEADING)}>{t.title}</Link>
                  <span className="hidden w-[150px] shrink-0 sm:block">
                    <span className="inline-flex items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4"
                      style={{ background: `var(--status-${STATUS_TONE[t.status]}-bg)`, color: `var(--status-${STATUS_TONE[t.status]}-fg)` }}>
                      <ClipboardList className="size-3.5" aria-hidden />{STATUS_LABEL[t.status]}
                    </span>
                  </span>
                  <span className="hidden w-[100px] shrink-0 truncate text-ui-text-secondary md:block">{SOURCE_LABEL[t.source]}</span>
                  <span className={cn('w-[140px] shrink-0 truncate text-right', late ? 'font-semibold text-error-normal' : 'text-ui-text-secondary')}>
                    {t.dueDate ? `${late ? 'Overdue · ' : ''}${fmtDay(parseDay(t.dueDate))}` : 'No date'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── KPIs ── */}
      {access.projects && projects && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-4">
          <Kpi label="Active Projects" value={active.length} icon={<BriefcaseBusiness strokeWidth={1.5} />} color="var(--ui-btn-solid)" onColor="var(--ui-surface-elevated)"
            sub={`${inProduction.length} in production`} badge={newInRange ? `+${newInRange} New` : undefined} spark={spark(scoped, p => p.created_at)} href="/projects" />
          {access.opportunities && opportunities !== 'denied' && (
            <Kpi label="Total Clients Opportunity" value={typeof opportunities === 'number' ? opportunities : opportunities === null ? '…' : '—'} icon={<UserRound strokeWidth={1.5} />}
              color="var(--status-t4-fg)" onColor="var(--status-t4-bg)" sub="Key clients’ open deals" spark={[0, 0, 0, 0, 0, 0]} href="/tlines-pm" />
          )}
          <Kpi label="Deals Closed" value={closed.length} icon={<CircleCheck strokeWidth={1.5} />} color="var(--status-t6-fg)" onColor="var(--status-t6-bg)"
            sub={`${PRESETS.find(p => p.value === preset)?.label ?? `${fmtDay(from)} – ${fmtDay(to)}`}`} spark={spark(scoped, p => p.closed_deal_date)} href="/projects" />
          <Kpi label="Waiting for my approval" value={Array.isArray(approvals) ? approvals.length : approvals === null ? '…' : '—'} icon={<ClipboardPenLine strokeWidth={1.5} />}
            color="var(--status-t9-fg)" onColor="var(--status-t9-bg)" sub={`${po.length} PO · ${pf.length} PF`} spark={[0, 0, 0, 0, 0, 0]} href="/workspace/approvals" />
        </div>
      )}

      {/* ── Containers / PO / PF ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {containers !== 'denied' && (
          <ListCard title="Containers" icon={<Ship strokeWidth={1.5} />} color="var(--status-t8-fg)" href="/logistics"
            state={state(containers, upcoming.length)} emptyText="No containers on the way.">
            {upcoming.slice(0, 3).map(c => {
              const eta = parseDay(c.estimated_arrival_date!);
              const left = Math.round((eta.getTime() - dayStart(now).getTime()) / 86400000);
              return (
                <Row key={c.id} color="var(--status-t8-fg)" href={`/logistics/${c.id}`} label={`Open container ${c.container_no ?? ''}`} action="none"
                  lead={<Link href={`/logistics/${c.id}`} aria-label={`Open container ${c.container_no ?? ''}`} className="inline-flex size-[35px] items-center justify-center rounded-[6px] text-current" style={{ background: 'var(--status-t8-bg)' }}><Ship className="size-[22px]" strokeWidth={1.5} aria-hidden /></Link>}
                  title={`Container ${c.container_no ?? '#'}`} sub={`${c.item_count} item${c.item_count === 1 ? '' : 's'}`}
                  right={<>
                    <Pill solid={left <= 7} color={left <= 7 ? 'var(--color-error-normal)' : 'var(--status-t8-fg)'}>{left < 0 ? `${-left} day${left === -1 ? '' : 's'} late` : `${left} day${left === 1 ? '' : 's'} left`}</Pill>
                    <span className="flex w-[34px] flex-col items-center text-center leading-[1.1]">
                      <span className="text-[14px] tracking-[-0.308px]">{MON.format(eta).toUpperCase()}</span>
                      <span className="text-[24px] font-semibold">{eta.getDate()}</span>
                    </span>
                  </>} />
              );
            })}
          </ListCard>
        )}
        {[{ title: 'PO to Sign', list: po, t: 't1', icon: <ClipboardPenLine strokeWidth={1.5} />, empty: 'No POs waiting for you.' },
          { title: 'PF to Sign', list: pf, t: 't7', icon: <ClipboardPenLine strokeWidth={1.5} />, empty: 'No PFs waiting for you.' }].map(card => (
          <ListCard key={card.title} title={card.title} icon={card.icon} color={`var(--status-${card.t}-fg)`} href="/workspace/approvals"
            state={state(docState, card.list.length)} emptyText={card.empty}>
            {card.list.slice(0, 3).map(a => {
              const age = ageDays(a.createdAt);
              return (
                <Row key={a.approvalId} color={`var(--status-${card.t}-fg)`} href={`/projects/${a.projectId}`} label={`Open ${a.projectCode} ${a.fileName}`}
                  lead={<CodeChip t={card.t}>#{a.projectCode}</CodeChip>} title={a.projectName} sub={`V${a.versionNum ?? a.version} · ${a.stageLabel}`}
                  right={age >= 3 ? <Pill solid color="var(--color-error-normal)">High Priority</Pill> : <Pill color={`var(--status-${card.t}-fg)`}>{age === 0 ? 'Today' : `${age} day${age === 1 ? '' : 's'}`}</Pill>} />
              );
            })}
          </ListCard>
        ))}
      </div>

      {/* ── Charts ── */}
      {access.projects && projects && (
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,726fr)_minmax(0,1050fr)]">
          <section aria-label="Total Projects starting per month" className="flex min-w-0 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface-elevated px-6 pb-8 pt-6">
            <header className="flex items-center justify-between gap-3">
              <h2 className={cn('m-0 text-[20px] font-semibold leading-[30px]', HEADING)}>Total Projects starting per {grouping}</h2>
              <Select aria-label="Group by" className="h-9 w-[120px]" value={grouping}
                options={[{ value: 'month', label: 'Monthly' }, { value: 'quarter', label: 'Quarterly' }]}
                onValueChange={v => v && setGrouping(v as 'month' | 'quarter')} />
            </header>
            <BarChart months={buckets} counts={barCounts} />
            <p className="sr-only">{buckets.map((b, i) => `${b.mon} ${b.year}: ${barCounts[i]}`).join(', ')}</p>
          </section>
          <section aria-label="Projects per month by Region" className="flex min-w-0 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface-elevated px-6 pb-6 pt-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={cn('m-0 text-[20px] font-semibold leading-[30px]', HEADING)}>Projects per month by Region</h2>
              <Select aria-label="Regions shown" className="h-9 w-[150px]" value={regionSeries}
                options={[{ value: '', label: 'All Regions' }, ...REGIONS.map(r => ({ value: r.key, label: r.key }))]}
                onValueChange={v => setRegionSeries((v ?? '') as RegionKey | '')} />
            </header>
            <AreaChart months={months} series={series} />
            <ul className="m-0 flex list-none justify-center gap-4 p-0 text-[12px] text-ui-text-secondary">
              {series.map(s => <li key={s.key} className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full" style={{ background: s.color }} />{s.key}</li>)}
            </ul>
            <p className="sr-only">{series.map(s => `${s.key}: ${months.map((m, i) => `${m.mon} ${m.year} ${s.values[i]}`).join(', ')}`).join('. ')}</p>
          </section>
        </div>
      )}

      {/* ── In Production / Installation / Design folders ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {access.projects && access.production && (
          <ListCard title="In Production" icon={<Factory strokeWidth={1.5} />} color="var(--status-t2-fg)" href="/production"
            state={projects === null ? 'error' : inProduction.length ? 'ready' : 'empty'} emptyText="No projects in production.">
            {inProduction.slice(0, 3).map(p => (
              <Row key={p.id} color="var(--status-t2-fg)" href={`/projects/${p.id}`} label={`Open ${p.code}`}
                lead={<CodeChip t="t2">#{p.code}</CodeChip>} title={p.name} sub={p.site_location || regionOf(p.region) || '—'}
                right={p.categories?.[0] ? <Pill color="var(--status-t2-fg)">{p.categories[0].charAt(0).toUpperCase() + p.categories[0].slice(1).toLowerCase()}</Pill> : undefined} />
            ))}
          </ListCard>
        )}
        {installs !== 'denied' && (
          <ListCard title="Installation" icon={<Drill strokeWidth={1.5} />} color="var(--status-t8-fg)" href="/tlines-pm/installation"
            state={state(installs, installRows.length)} emptyText="No installations planned.">
            {installRows.slice(0, 3).map(r => (
              <Row key={r.id} color="var(--status-t8-fg)" href="/tlines-pm/installation" label={`Open installation ${r.project_no ?? ''}`}
                lead={<CodeChip t="t8">#{r.project_no ?? '—'}</CodeChip>} title={r.project_name ?? 'Untitled'}
                sub={[r.city_state, r.planned_start && fmtDay(parseDay(r.planned_start))].filter(Boolean).join(' · ') || '—'}
                right={r.status === 'Delayed' ? <Pill solid color="var(--color-error-normal)">Delayed</Pill> : r.status ? <Pill color="var(--status-t8-fg)">{r.status}</Pill> : undefined} />
            ))}
          </ListCard>
        )}
        {access.projects && (
          <ListCard title="New Design Folders" icon={<FolderClosed strokeWidth={1.5} />} color="var(--ui-btn-solid)" href="/design"
            state={designDocs === null ? 'error' : designDocs.length ? 'ready' : 'empty'} emptyText="No new design files.">
            {(designDocs ?? []).map(d => (
              <Row key={d.id} color="var(--ui-btn-solid)" href={`/projects/${d.project_id}`} label={`Open ${d.file_name}`} action="none"
                lead={null} title={d.file_name} sub={fileSize(d.file_size_bytes) || '—'}
                right={<>
                  <span className="text-[12px] text-ui-text-secondary">{fmtDay(new Date(d.created_at)).toUpperCase()} - {TIME.format(new Date(d.created_at))}</span>
                  <OpenFile id={d.id} name={d.file_name} />
                </>} />
            ))}
          </ListCard>
        )}
      </div>
    </div>
  );
}

/** Opens the file from Dropbox (same temporary-link endpoint as the project documents table). */
function OpenFile({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    const win = window.open('', '_blank');
    const res = await fetch(`/api/files/view?documentId=${encodeURIComponent(id)}`).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (body?.link && win) { win.opener = null; win.location.href = body.link; return; }
    win?.close();
    toast.error('Could not open the file');
  }
  return (
    <button type="button" onClick={() => void open()} disabled={busy} aria-label={`Open ${name}`}
      className="inline-flex size-[35px] cursor-pointer items-center justify-center rounded-[6px] border border-current bg-ui-surface-elevated text-current transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring disabled:opacity-60">
      <ExternalLink className="size-5" aria-hidden />
    </button>
  );
}
