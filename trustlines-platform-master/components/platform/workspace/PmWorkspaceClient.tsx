'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Briefcase, CalendarClock, CalendarDays, Check, CircleAlert, Clock, Factory, Hammer,
  ListFilter, MoreHorizontal, PenTool, Search, TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PortfolioRow } from '@/lib/workspace/rows';
import { Select } from '@/components/platform/shared/Select';

// Figma "PM" workspace (node 207:18326). Only what the lifecycle data really has is shown —
// the design's date-range picker, "Create task", readiness % and "+N new" have no backing data.

const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'rounded-[8px] border border-ui-divider bg-ui-page-bg';
const TH_CLS = 'h-[46px] whitespace-nowrap px-2.5 text-left text-[12px] font-semibold leading-[1.4] text-ui-body';
const TD_CLS = 'px-2.5 py-2 text-[13px] text-ui-body';
const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric' });
const MON = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const asDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

type Tone = 't0' | 't2' | 't6' | 't7' | 't10';
function Chip({ tone, icon: Icon, children }: { tone: Tone; icon?: typeof Check; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4"
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
    >
      {Icon && <Icon size={14} aria-hidden />}{children}
    </span>
  );
}

function priorityChip(p: number) {
  if (p >= 70) return <Chip tone="t10" icon={CircleAlert}>High priority</Chip>;
  if (p >= 50) return <Chip tone="t7" icon={Clock}>Medium</Chip>;
  return <Chip tone="t2" icon={Clock}>Normal</Chip>;
}

function dueChip(iso: string, isOverdue: boolean) {
  const days = Math.round((asDate(iso).getTime() - startOfToday()) / DAY_MS);
  if (isOverdue || days < 0) return <Chip tone="t10" icon={TriangleAlert}>{Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'} overdue</Chip>;
  if (days === 0) return <Chip tone="t7" icon={Clock}>Today</Chip>;
  if (days === 1) return <Chip tone="t7" icon={Clock}>Tomorrow</Chip>;
  return <Chip tone="t2" icon={CalendarClock}>Upcoming</Chip>;
}

type StatusKey = 'waiting' | 'blocked' | 'on_track';
function statusOf(r: PortfolioRow): StatusKey {
  if (r.myActions.length > 0) return 'waiting';
  if (r.blockers.length > 0) return 'blocked';
  return 'on_track';
}
const STATUS_CHIP: Record<StatusKey, { tone: Tone; icon: typeof Check; label: string }> = {
  waiting: { tone: 't7', icon: Clock, label: 'Waiting on you' },
  blocked: { tone: 't10', icon: CircleAlert, label: 'Blocked' },
  on_track: { tone: 't6', icon: Check, label: 'On track' },
};

const PRODUCTION_PHASES = new Set(['PRODUCTION_LOGISTICS', 'DELIVERY_BUILD']);
const FINALIZING_PHASES = new Set(['CLOSED_DEAL', 'PM_FINALIZATION', 'APPROVALS']);

export function PmWorkspaceClient({ rows, seesAll }: { rows: PortfolioRow[]; seesAll: boolean }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | StatusKey>('');
  const [dueSort, setDueSort] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);
  const [today] = useState(startOfToday);

  const active = rows.filter(r => r.phase !== 'COMPLETED');
  const kpis = [
    { label: 'Active Projects', value: active.length, icon: Briefcase },
    { label: 'Supply & Approvals', value: active.filter(r => r.phase === 'SUPPLY_DEVELOPMENT').length, icon: PenTool },
    { label: 'In Production', value: active.filter(r => PRODUCTION_PHASES.has(r.phase)).length, icon: Factory },
    { label: 'Finalizing', value: active.filter(r => FINALIZING_PHASES.has(r.phase)).length, icon: Hammer },
  ];

  // Every action that is waiting on the viewer, most urgent first.
  const waiting = useMemo(() => rows
    .flatMap(r => r.myActions.map(a => ({ ...a, row: r })))
    .sort((a, b) => b.priority - a.priority), [rows]);

  // Type target dates that are overdue or due within the next 7 days.
  const upcoming = useMemo(() => rows
    .flatMap(r => r.deadlines.map(d => ({ ...d, row: r })))
    .filter(d => d.isOverdue || asDate(d.targetDate).getTime() <= today + 7 * DAY_MS)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    .slice(0, 6), [rows, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows
      .filter(r => !statusFilter || statusOf(r) === statusFilter)
      .filter(r => !q || [r.code ?? '', r.name ?? '', r.phaseLabel].some(v => v.toLowerCase().includes(q)));
    if (!dueSort) return list;
    const dir = dueSort === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const da = a.deadlines[0]?.targetDate, db = b.deadlines[0]?.targetDate;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return dir * da.localeCompare(db);
    });
  }, [rows, query, statusFilter, dueSort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Supply', href: '/projects' }, { label: 'PM', href: '/pm' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>PM</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {seesAll ? 'Every active project, with what is blocking it.' : 'The projects you are PM on, and what is waiting on you.'}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="flex flex-col gap-4 rounded-[8px] bg-ui-selected-bg p-4">
            <span className="grid size-10 place-items-center rounded-[6px] bg-ui-page-bg text-[var(--color-secondary-700)] dark:text-ui-heading">
              <k.icon size={20} aria-hidden />
            </span>
            <div>
              <div className="text-[13px] text-[var(--color-secondary-700)] dark:text-ui-heading">{k.label}</div>
              <div className={cn('text-[28px] font-semibold leading-tight', HEADING_TEXT)}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Waiting on me + Upcoming deadlines */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_432px]">
        <section className={cn(CARD, 'flex flex-col bg-ui-surface p-5')} aria-labelledby="pm-waiting-title">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pm-waiting-title" className={cn('m-0 text-[17px] font-semibold', HEADING_TEXT)}>Waiting on me</h2>
            <Chip tone="t0" icon={Clock}>{waiting.length} open</Chip>
            <span className="ml-auto text-[11px] text-ui-text-secondary">Ordered by urgency</span>
          </div>
          <p className="mb-2 mt-1 text-[11px] text-ui-text-secondary">Your next step on each project — approvals, handovers and blockers assigned to you.</p>
          {waiting.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-[13px] text-ui-text-secondary">
              <Check size={24} aria-hidden /> Nothing is waiting on you.
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {waiting.slice(0, 8).map(a => (
                <li key={`${a.row.projectId}-${a.code}`} className="flex items-center gap-3 border-b border-ui-divider py-4 last:border-b-0">
                  <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-secondary-700)] dark:bg-ui-heading" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className={cn('truncate text-[13px] font-medium', HEADING_TEXT)}>{a.action}</div>
                    <div className="truncate text-[11px] text-ui-text-secondary">
                      {[a.row.code, a.row.name, a.row.phaseLabel].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="hidden shrink-0 sm:block">{priorityChip(a.priority)}</div>
                  <Link
                    href={a.href}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[12px] font-medium text-[var(--color-secondary-700)] no-underline hover:bg-ui-hover-bg dark:text-ui-heading"
                  >
                    <ArrowUpRight size={14} aria-hidden /> Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {waiting.length > 8 && <p className="m-0 mt-2 text-[11px] text-ui-text-secondary">+{waiting.length - 8} more in My Projects below.</p>}
        </section>

        <section className={cn(CARD, 'flex flex-col gap-3 bg-ui-surface p-4')} aria-labelledby="pm-deadlines-title">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-ui-body" aria-hidden />
            <h2 id="pm-deadlines-title" className={cn('m-0 text-[17px] font-semibold', HEADING_TEXT)}>Upcoming deadlines</h2>
            <span className="ml-auto text-[11px] text-ui-text-secondary">Next 7 days</span>
          </div>
          <p className="m-0 text-[11px] text-ui-text-secondary">{upcoming.length} type target date{upcoming.length === 1 ? '' : 's'} due or overdue</p>
          {upcoming.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-ui-text-secondary">No target dates in the next 7 days.</div>
          ) : upcoming.map(d => {
            const at = asDate(d.targetDate);
            return (
              <Link
                key={`${d.row.projectId}-${d.type}-${d.targetDate}`}
                href={`/projects/${d.row.projectId}/types`}
                className="flex items-center gap-4 rounded-[6px] bg-ui-page-bg px-4 py-3 no-underline hover:brightness-[0.98]"
              >
                <span className="flex w-9 shrink-0 flex-col items-center leading-tight text-ui-body">
                  <span className="text-[10px] uppercase">{MON.format(at)}</span>
                  <span className={cn('text-[22px] font-semibold', HEADING_TEXT)}>{DAY.format(at)}</span>
                  <span className="text-[10px] uppercase">{WEEKDAY.format(at)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px] font-medium', HEADING_TEXT)}>{d.type} · {d.stage}</span>
                  <span className="block truncate text-[11px] text-ui-text-secondary">{[d.row.code, d.row.name].filter(Boolean).join(' · ')}</span>
                  <span className="mt-1 block">{dueChip(d.targetDate, d.isOverdue)}</span>
                </span>
              </Link>
            );
          })}
        </section>
      </div>

      {/* My Projects */}
      <section className={cn(CARD, 'overflow-hidden')} aria-labelledby="pm-projects-title">
        <div className="flex flex-wrap items-center gap-2.5 px-3 py-3">
          <h2 id="pm-projects-title" className={cn('m-0 mr-4 text-[17px] font-semibold', HEADING_TEXT)}>{seesAll ? 'All Projects' : 'My Projects'}</h2>
          <div className="relative min-w-[200px] max-w-[270px] flex-[1_1_200px]">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
            <input
              className="form-input"
              style={{ height: 36, paddingLeft: 30, fontSize: 13, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)' }}
              placeholder="Search my projects…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}
              aria-label="Search projects"
            />
          </div>
          <span className="inline-flex items-center gap-1.5">
            <ListFilter size={14} className="text-ui-text-secondary" aria-hidden />
            <Select
              className="form-input" aria-label="Filter by project status"
              style={{ height: 36, fontSize: 12, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)', minWidth: 150 }}
              value={statusFilter} onChange={e => { setStatusFilter(e.target.value as '' | StatusKey); setPage(1); }}
            >
              <option value="">All projects</option>
              <option value="waiting">Waiting on you</option>
              <option value="blocked">Blocked</option>
              <option value="on_track">On track</option>
            </Select>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr className="border-y border-ui-divider bg-ui-surface">
                <th className={cn(TH_CLS, 'pl-4')}>Project</th>
                <th className={TH_CLS}>Current stage</th>
                <th className={TH_CLS}>Project status</th>
                <th className={TH_CLS}>Next milestone</th>
                <th className={TH_CLS} aria-sort={dueSort ? (dueSort === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button
                    type="button"
                    onClick={() => setDueSort(s => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))}
                    className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-[inherit] text-[inherit]"
                    title="Sort by due date"
                  >
                    Due date {dueSort === 'asc' ? '↑' : dueSort === 'desc' ? '↓' : ''}
                  </button>
                </th>
                <th className={TH_CLS}>Waiting on me</th>
                <th className={cn(TH_CLS, 'w-12 pr-4')}><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-ui-text-secondary">No projects match.</td></tr>
              )}
              {pageRows.map(r => {
                const st = STATUS_CHIP[statusOf(r)];
                const next = r.deadlines[0];
                const nextDays = next ? Math.round((asDate(next.targetDate).getTime() - today) / DAY_MS) : null;
                return (
                  <tr key={r.projectId} className="h-16 border-b border-ui-divider last:border-b-0 hover:bg-ui-surface">
                    <td className={cn(TD_CLS, 'max-w-[260px] pl-4')}>
                      <Link href={`/projects/${r.projectId}`} className={cn('block truncate text-[13px] font-semibold no-underline', HEADING_TEXT)}>{r.name ?? r.code ?? '—'}</Link>
                      <span className="block truncate text-[11px] text-ui-text-secondary">{r.code}</span>
                    </td>
                    <td className={TD_CLS}>{r.phaseLabel}</td>
                    <td className={TD_CLS}>
                      <span title={r.blockers.map(b => b.message).join(' · ') || undefined}>
                        <Chip tone={st.tone} icon={st.icon}>{st.label}</Chip>
                      </span>
                    </td>
                    <td className={cn(TD_CLS, 'max-w-[240px] truncate')}>
                      {next ? `${next.type} · ${next.stage}` : (r.blockers[0]?.message ?? '—')}
                    </td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>
                      {next ? (
                        <>
                          <span style={next.isOverdue ? { color: 'var(--status-t10-fg)' } : undefined}>{DATE.format(asDate(next.targetDate))}</span>
                          {nextDays !== null && nextDays <= 1 && (
                            <span className="block text-[11px]" style={{ color: next.isOverdue || nextDays < 0 ? 'var(--status-t10-fg)' : 'var(--status-t7-fg)' }}>
                              {next.isOverdue || nextDays < 0 ? 'Overdue' : nextDays === 0 ? 'Today' : 'Tomorrow'}
                            </span>
                          )}
                        </>
                      ) : '—'}
                    </td>
                    <td className={TD_CLS}>
                      {r.myActions.length > 0 ? (
                        <Link href={r.myActions[0].href} className={cn('font-semibold no-underline', HEADING_TEXT)} title={r.myActions.map(a => a.action).join('\n')}>
                          {r.myActions.length} action{r.myActions.length === 1 ? '' : 's'}
                        </Link>
                      ) : <span className="text-ui-text-secondary">—</span>}
                    </td>
                    <td className={cn(TD_CLS, 'pr-4')}>
                      <Link href={`/projects/${r.projectId}`} aria-label={`Open ${r.name ?? r.code}`} className="grid size-8 place-items-center rounded-[6px] text-ui-body hover:bg-ui-hover-bg">
                        <MoreHorizontal size={16} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-divider px-4 py-3 text-[12px] text-ui-text-secondary">
          <span>Showing {filtered.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length} projects</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button>
              <span className="text-ui-body">Page {current} of {totalPages}</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>Next</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
