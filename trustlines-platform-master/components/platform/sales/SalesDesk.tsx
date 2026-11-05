'use client';

import {
  AlarmClock, ArrowUpRight, CalendarClock, CalendarDays, CircleCheck, CircleX, ClockAlert, FileText, Map as MapIcon,
  TrendingUp, UserRound, UserX,
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import type { SalesDashboardData } from '@/lib/sales/dashboardData';
import type { ClosingRow, RegionRow, SilentDeal, StageBucket } from '@/lib/sales/dashboardMetrics';
import { regionLabel } from '@/lib/regions';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

// Sales insights (Figma "Sales insights" 210:24157): page heading, scope toolbar, then four analytics
// cards — where the open deals sit · deals that have gone quiet · region by region · won and lost by
// quarter closed. Every figure comes from lib/sales/dashboardData.ts; the frame's region / owner /
// deal-type filters and "Export report" have no backing feature, so the toolbar carries the task links.
// Dark (Figma 265:21163): same tokens; stage bars switch to the near-white heading tone like the frame.

const n = (v: number) => v.toLocaleString('en-US');
function usd(v: number, digits = 1): string {
  if (v >= 1_000_000) return `USD ${(v / 1_000_000).toFixed(digits)}m`;
  if (v >= 1_000) return `USD ${Math.round(v / 1_000)}k`;
  return `USD ${n(Math.round(v))}`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM-DD' → '21 Oct 2026' without going through the timezone. */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso;
}
/** ClosingRow.key '2026-Q3' → 'Q3 2026'. */
const quarterLabel = (key: string) => `${key.slice(5)} ${key.slice(0, 4)}`;
const stageQuery = (status: string) => `/leads?stage=${status}`;

const CARD = 'flex min-w-0 flex-col gap-[18px] rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-6';
const TITLE = 'm-0 text-[18px] font-semibold leading-[normal] text-[var(--color-secondary-700)] dark:text-ui-heading';
const SUB = 'm-0 text-[12px] leading-[1.4] text-ui-text-secondary';
const NOTE = 'm-0 text-[12px] leading-[1.4] text-ui-text-secondary';
const ACTION = 'inline-flex h-9 items-center gap-2 rounded-[6px] border border-ui-divider bg-ui-surface-elevated px-3 text-[13px] font-medium leading-[1.4] whitespace-nowrap text-ui-body no-underline hover:bg-ui-hover-bg [&_svg]:size-4 [&_svg]:shrink-0';

function CardHeading({ icon, title, sub, aside }: { icon?: React.ReactNode; title: string; sub: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2 text-ui-body [&_svg]:size-[18px] [&_svg]:shrink-0">
          {icon}
          <h2 className={TITLE}>{title}</h2>
        </div>
        <div className={SUB}>{sub}</div>
      </div>
      {aside}
    </div>
  );
}

interface Tip { x: number; y: number; head: string; rows: { key: string; label: string; value: string }[]; foot?: string }

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed z-[10070] min-w-[170px] rounded-[10px] border border-ui-divider bg-ui-surface-elevated px-3 py-[9px] text-[12.5px] text-ui-body shadow-03"
      style={{ left: Math.min(tip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 250), top: tip.y + 14 }}
    >
      <div className="mb-1.5 font-semibold text-ui-heading">{tip.head}</div>
      {tip.rows.map(r => (
        <div key={r.label} className="mt-[3px] flex items-center gap-2">
          <span className="h-[3px] w-3 shrink-0 rounded-[2px]" style={{ background: r.key }} />
          <span className="font-semibold">{r.value}</span>
          <span className="text-ui-text-secondary">{r.label}</span>
        </div>
      ))}
      {tip.foot && <div className="mt-1.5 text-[12px] text-ui-text-secondary">{tip.foot}</div>}
    </div>
  );
}

function niceMax(v: number, maxTicks = 4): { max: number; step: number } {
  const steps = [1, 2, 5, 10, 15, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find(s => v / s <= maxTicks) ?? Math.ceil(v / maxTicks / 1000) * 1000;
  return { max: Math.max(step, Math.ceil(v / step) * step), step };
}

// ── where the open deals sit (Figma 210:24257 "Stage bar chart") ─────────────────────────────────
function StageChart({ path, waiting }: { path: StageBucket[]; waiting: { count: number; value: number } }) {
  const rows = [
    ...path.map(s => ({ key: s.key, label: s.label, href: stageQuery(s.crmStatus), count: s.count, muted: false })),
    { key: 'waiting', label: 'Waiting on the client', href: stageQuery('waiting'), count: waiting.count, muted: true },
  ];
  const total = rows.reduce((a, r) => a + r.count, 0);
  if (total === 0) return <p className={NOTE}>No open deals right now.</p>;
  const { max, step } = niceMax(Math.max(...rows.map(r => r.count)));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-3.5 text-[11px] leading-[1.4] text-ui-text-secondary">
        <span className="w-[152px] shrink-0">Sales stage</span>
        <span className="min-w-0 flex-1">Open deals (count)</span>
        <span className="w-11 shrink-0 text-right">Count</span>
        <span className="w-[58px] shrink-0 text-right">Share</span>
      </div>
      {rows.map(r => (
        <Link
          key={r.key} href={r.href} aria-label={`${r.label}: ${r.count} open deals`}
          className="group flex items-center gap-3.5 text-ui-body no-underline"
        >
          <span className="w-[152px] shrink-0 truncate text-[13px] leading-[1.4] group-hover:underline">{r.label}</span>
          <span className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-ui-surface">
            <span
              className={cn('absolute inset-y-0 left-0 rounded-[3px] transition-[filter] group-hover:brightness-110', r.muted ? 'bg-ui-text-secondary' : 'bg-ui-btn-primary dark:bg-ui-heading')}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </span>
          <span className="w-11 shrink-0 text-right text-[14px] font-semibold leading-[1.4] tabular-nums">{n(r.count)}</span>
          <span className="w-[58px] shrink-0 text-right text-[12px] leading-[1.4] tabular-nums text-ui-text-secondary">
            {((r.count / total) * 100).toFixed(1)}%
          </span>
        </Link>
      ))}
      {/* Count axis: under the bar track only (152 label + 14 gap | 14 + 44 + 14 + 58 on the right). */}
      <div className="relative ml-[166px] mr-[130px] h-[15px] text-[11px] leading-[1.4] text-ui-text-secondary">
        {ticks.map((t, i) => (
          <span
            key={t} className="absolute top-0 tabular-nums"
            style={{ left: `${(t / max) * 100}%`, transform: i === 0 ? undefined : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── deals that have gone quiet (Figma 210:24309 "Follow-up list") ────────────────────────────────
function QuietList({ rows }: { rows: SilentDeal[] }) {
  if (!rows.length) return <p className={NOTE}>Every active deal has had an update recently.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[560px] flex-col">
        <div className="flex h-7 items-center gap-3 text-[11px] leading-[1.4] text-ui-text-secondary">
          <span className="min-w-0 flex-1">Deal / stage / region</span>
          <span className="flex w-[122px] shrink-0 items-center gap-[5px]"><UserRound size={14} aria-hidden />Owner</span>
          <span className="w-[87px] shrink-0 text-right">Value (USD)</span>
          <span className="w-[133px] shrink-0 text-right">Days since last touch</span>
          <span className="size-4 shrink-0" />
        </div>
        {rows.map(r => {
          const overdue = r.daysSilent > 30;
          const where = [r.stageLabel, r.region ? regionLabel(r.region) : null].filter(Boolean).join(' · ');
          return (
            <Link
              key={r.id} href={`/leads?open=${r.id}`}
              title={r.lastSnippet ? `${r.lastBy ? `${r.lastBy}: ` : ''}${r.lastSnippet}` : 'Nothing since it was created'}
              className="group flex h-[46px] items-center gap-3 border-t border-ui-divider text-ui-body no-underline hover:bg-ui-hover-bg"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-px leading-[1.4]">
                <span className="truncate text-[13px] font-semibold text-ui-nav-active group-hover:underline">{r.title}</span>
                <span className="truncate text-[10px] text-ui-text-secondary">{where}</span>
              </span>
              <span className="w-[122px] shrink-0 truncate text-[12px] leading-[1.4]">{r.ownerName ?? 'Unassigned'}</span>
              <span className="w-[87px] shrink-0 text-right text-[12px] leading-[1.4] tabular-nums">
                {r.dealSize ? n(r.dealSize) : <span className="text-ui-text-secondary">—</span>}
              </span>
              <span className={cn('w-[133px] shrink-0 text-right text-[13px] font-semibold leading-[1.4] tabular-nums', overdue && 'text-error-normal')}>
                {n(r.daysSilent)} {r.daysSilent === 1 ? 'day' : 'days'}
              </span>
              <ArrowUpRight size={16} aria-hidden className="shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── region by region (Figma 210:24382 "Regional comparison table") ───────────────────────────────
function RegionTable({ rows }: { rows: RegionRow[] }) {
  if (!rows.length) return <p className={NOTE}>No deals with a region yet.</p>;
  const sum = (k: 'open' | 'proposals' | 'waiting' | 'won' | 'lost') => rows.reduce((a, r) => a + r[k], 0);
  const won = sum('won'), lost = sum('lost');
  const rate = won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : '—';
  const cell = 'px-0 text-left font-normal';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-[13px] leading-[1.4] tabular-nums">
        <thead>
          <tr className="h-[38px] bg-ui-surface text-[12px] text-ui-body [&>th]:font-medium">
            <th className={cn(cell, 'pl-3')}>Region</th>
            <th className={cell}>Open</th>
            <th className={cell}>Proposal Out</th>
            <th className={cell}>Waiting</th>
            <th className={cell}>Won</th>
            <th className={cell}>Lost</th>
            <th className={cn(cell, 'pr-3')}>Won rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.region} className="h-[49px] border-t border-ui-divider text-ui-body">
              <td className="pl-3 font-semibold text-ui-nav-active">{r.label}</td>
              <td>{n(r.open)}</td>
              <td>{n(r.proposals)}</td>
              <td>{n(r.waiting)}</td>
              <td>{n(r.won)}</td>
              <td>{n(r.lost)}</td>
              <td className="pr-3">{r.winRatePct == null ? '—' : `${r.winRatePct}%`}</td>
            </tr>
          ))}
          <tr className="h-[49px] border-t border-ui-divider bg-ui-surface font-semibold text-ui-body">
            <td className="pl-3">All regions</td>
            <td>{n(sum('open'))}</td>
            <td>{n(sum('proposals'))}</td>
            <td>{n(sum('waiting'))}</td>
            <td>{n(won)}</td>
            <td>{n(lost)}</td>
            <td className="pr-3">{rate}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── won and lost, by quarter closed (Figma 210:24426 "Quarterly grouped column chart") ────────────
const PLOT_TOP = 26, PLOT_BASE = 180; // gridlines run 26 → 180; the headroom holds the bar labels

function ClosingsChart({ rows, view }: { rows: ClosingRow[]; view: 'chart' | 'table' }) {
  const [tip, setTip] = useState<Tip | null>(null);
  if (!rows.length) return <EmptyState size="sm" icon={<TrendingUp />} title="No closed deals with a recorded close date yet." />;

  if (view === 'table') {
    return (
      <div className="max-h-[230px] overflow-auto">
        <table className="w-full border-collapse text-[13px] leading-[1.4] tabular-nums text-ui-body">
          <thead>
            <tr className="h-[38px] bg-ui-surface text-left text-[12px] [&>th]:font-medium">
              <th className="pl-3">Quarter</th><th>Won</th><th>Lost</th><th>Closed</th><th className="pr-3">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map(r => (
              <tr key={r.key} className="h-10 border-t border-ui-divider">
                <td className="pl-3 font-semibold">{quarterLabel(r.key)}</td><td>{n(r.won)}</td><td>{n(r.lost)}</td>
                <td>{n(r.total)}</td><td className="pr-3">{r.winRatePct == null ? '—' : `${r.winRatePct}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const peak = Math.max(1, ...rows.map(r => Math.max(r.won, r.lost)));
  const { max, step } = niceMax(peak);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => max - i * step);
  const y = (v: number) => PLOT_BASE - (v / max) * (PLOT_BASE - PLOT_TOP);
  const h = (v: number) => (v / max) * (PLOT_BASE - PLOT_TOP);
  const crowded = rows.length > 8;
  const labelEvery = rows.length > 12 ? 2 : 1;

  const show = (e: React.PointerEvent | React.FocusEvent<HTMLElement>, r: ClosingRow) => {
    const pos = 'clientX' in e ? { x: e.clientX, y: e.clientY } : (() => { const b = e.currentTarget.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top }; })();
    setTip({
      ...pos, head: quarterLabel(r.key),
      rows: [{ key: 'var(--color-success-normal)', label: 'won', value: n(r.won) }, { key: 'var(--color-error-normal)', label: 'lost', value: n(r.lost) }],
      foot: r.winRatePct == null ? 'Nothing closed' : `${r.winRatePct}% of what closed was won`,
    });
  };

  return (
    <div className="flex h-[212px] items-start gap-3" onPointerLeave={() => setTip(null)}>
      <div className="relative h-[196px] w-6 shrink-0 text-right text-[11px] leading-[1.4] tabular-nums text-ui-text-secondary" aria-hidden>
        {ticks.map(t => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: y(t) }}>{t}</span>)}
      </div>
      <div className="relative h-[212px] min-w-0 flex-1" role="img" aria-label="Deals won and lost per quarter closed">
        {ticks.map(t => <div key={t} className="absolute inset-x-0 h-px bg-ui-divider" style={{ top: y(t) }} />)}
        <div className={cn('relative flex h-full items-start', crowded ? 'justify-between px-2' : 'justify-between px-[30px]')}>
          {rows.map((r, i) => (
            <div
              key={r.key} tabIndex={0}
              aria-label={`${quarterLabel(r.key)}: ${r.won} won, ${r.lost} lost${r.winRatePct == null ? '' : `, ${r.winRatePct}% win rate`}`}
              onPointerMove={e => show(e, r)} onFocus={e => show(e, r)} onBlur={() => setTip(null)}
              className="flex min-w-0 flex-col items-center gap-2.5 rounded-[4px] outline-none focus-visible:outline-2 focus-visible:outline-ui-focus-ring"
            >
              <div className={cn('flex h-[180px] items-end', crowded ? 'gap-1' : 'gap-2.5')}>
                {([['won', r.won, 'bg-success-normal'], ['lost', r.lost, 'bg-error-normal']] as const).map(([k, v, bg]) => (
                  <div key={k} className={cn('flex h-full flex-col items-center justify-end gap-[5px]', crowded ? 'w-3' : 'w-[38px]')}>
                    {!crowded && <span className="text-[12px] font-semibold leading-[1.4] tabular-nums text-ui-body">{v}</span>}
                    <span className={cn('w-full rounded-t-[3px]', bg)} style={{ height: h(v) }} />
                  </div>
                ))}
              </div>
              <span className={cn('text-[12px] leading-[1.4] whitespace-nowrap text-ui-body', i % labelEvery !== 0 && 'invisible')}>
                {crowded ? r.key.slice(5) + ' ’' + r.key.slice(2, 4) : quarterLabel(r.key)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────────────────────────
export function SalesDesk({ data }: { data: SalesDashboardData }) {
  const { tasks, outcomes } = data;
  const [closingsView, setClosingsView] = useState<'chart' | 'table'>('chart');
  const proposalsOut = data.path.filter(p => p.key === 'proposal' || p.key === 'changes').reduce((a, p) => a + p.count, 0);
  const decided = outcomes.won + outcomes.lost;
  const today = dayLabel(data.today);
  const quietValue = data.silent.reduce((a, s) => a + (s.dealSize ?? 0), 0);
  const firstQ = data.closings[0]?.key, lastQ = data.closings.at(-1)?.key;

  // Only say things that are true right now.
  const notes: string[] = [];
  if (tasks.unassigned > 0 && tasks.unassigned === tasks.open) notes.push(`None of the ${n(tasks.open)} open tasks has an owner yet — assign them from Tasks.`);
  else if (tasks.unassigned > 0) notes.push(`${n(tasks.unassigned)} open tasks have no owner yet.`);
  if (data.activeDeals > 0 && data.silentOver30 > 0) notes.push(`${n(data.silentOver30)} of ${n(data.activeDeals)} deals that should be moving haven’t had an update in over 30 days.`);

  return (
    <div className="flex flex-col gap-6">
      {/* Figma 210:24228 "Page heading and scope" */}
      <div className="flex flex-col gap-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-[5px]">
            <PageCrumbs className="uppercase" items={[{ label: 'Sales', href: '/leads' }, { label: 'Insights', href: '/sales-dashboard' }]} />
            <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">Sales insights</h1>
            <p className="m-0 text-[13px] leading-[1.4] text-ui-body">See where the pipeline stands, what needs a follow-up, and how deals close.</p>
          </div>
          <Link href="/leads" className={ACTION}><ArrowUpRight aria-hidden />Open the CRM</Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-ui-surface p-3">
          <div className="flex flex-wrap gap-2.5">
            <Link href="/sales-tasks?filter=today" className={ACTION}><CalendarClock aria-hidden />{n(tasks.dueToday)} due today</Link>
            <Link href="/sales-tasks?filter=overdue" className={cn(ACTION, tasks.overdue > 0 && 'text-error-normal')}><AlarmClock aria-hidden />{n(tasks.overdue)} overdue</Link>
            <Link href={stageQuery('design_proposal_sent')} className={ACTION}><FileText aria-hidden />{n(proposalsOut)} proposals out</Link>
            <Link href="/sales-tasks?filter=unassigned" className={ACTION}><UserX aria-hidden />{n(tasks.unassigned)} unowned tasks</Link>
          </div>
          <span className="flex items-center gap-2 text-[12px] leading-[1.4] text-ui-body">
            <CalendarDays size={16} aria-hidden />Current pipeline as of {today}
          </span>
        </div>

        {notes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {notes.map(t => (
              <p key={t} className="m-0 flex items-baseline gap-2.5 text-[13px] leading-[1.4] text-ui-body">
                <span className="size-1.5 shrink-0 -translate-y-px rounded-full bg-ui-nav-active" />{t}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={CARD}>
          <CardHeading
            title="Where the open deals sit"
            sub={`Current pipeline · All regions · ${today}`}
            aside={<span className="shrink-0 rounded-[4px] bg-ui-surface py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4 text-ui-body">Open only</span>}
          />
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
            <p className="m-0 font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">
              <span className="text-[28px]">{n(data.openDeals)}</span> <span className="text-[14px] font-normal">open deals</span>
            </p>
            {data.openValue > 0 && <p className="m-0 text-[14px] font-medium leading-[1.4] text-ui-body">{usd(data.openValue)} unweighted value</p>}
            <p className={SUB}>{n(data.potentials)} potentials still to qualify</p>
          </div>
          <StageChart path={data.path} waiting={data.waiting} />
          <p className={cn(NOTE, 'mt-auto')}>Stage counts are a snapshot, not conversion rates. Won and lost deals are excluded. Click a stage to open it in the CRM.</p>
        </section>

        <section className={CARD}>
          <CardHeading
            icon={<ClockAlert aria-hidden />}
            title="Deals that have gone quiet"
            sub={`${n(data.activeDeals)} active deals · Longest without an update first`}
            aside={quietValue > 0 ? <span className="shrink-0 text-[12px] font-semibold leading-[1.4] text-ui-body">{usd(quietValue, 2)}</span> : undefined}
          />
          <QuietList rows={data.silent} />
          <p className={cn(NOTE, 'mt-auto')}>
            Last touch = a comment or logged change. Covers Ready to start, Working on it Trust, Proposal sent and Changes requested — waiting deals are meant to sit.
          </p>
        </section>

        <section className={CARD}>
          <CardHeading icon={<MapIcon aria-hidden />} title="Region by region" sub={`Current pipeline · All owners · ${today}`} />
          <RegionTable rows={data.regions} />
          <p className={cn(NOTE, 'mt-auto')}>Potentials aren&apos;t counted until they become deals. Won rate = won ÷ (won + lost).</p>
        </section>

        <section className={CARD}>
          <CardHeading
            title="Won and lost, by quarter closed"
            sub={(
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                {firstQ && lastQ ? `${quarterLabel(firstQ)} – ${quarterLabel(lastQ)} · By close date · All regions` : 'By close date · All regions'}
              </span>
            )}
            aside={data.closings.length > 0 ? (
              <div className="flex shrink-0 gap-1.5" role="group" aria-label="Show as">
                {(['chart', 'table'] as const).map(v => (
                  <button
                    key={v} type="button" aria-pressed={closingsView === v} onClick={() => setClosingsView(v)}
                    className={cn(
                      'cursor-pointer rounded-[6px] border px-2.5 py-1 text-[12px] font-medium capitalize',
                      closingsView === v ? 'border-ui-btn-primary bg-ui-btn-primary text-ui-btn-primary-fg' : 'border-ui-divider bg-transparent text-ui-body hover:bg-ui-hover-bg',
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : undefined}
          />
          {closingsView === 'chart' && data.closings.length > 0 && (
            <div className="flex items-center justify-between text-[12px] leading-[1.4]">
              <span className="text-ui-text-secondary">Deals (count)</span>
              <span className="flex gap-5 font-medium">
                <span className="flex items-center gap-1.5 text-success-normal"><CircleCheck size={14} aria-hidden />Won</span>
                <span className="flex items-center gap-1.5 text-error-normal"><CircleX size={14} aria-hidden />Lost</span>
              </span>
            </div>
          )}
          <ClosingsChart rows={data.closings} view={closingsView} />
          <div className="mt-auto flex flex-col gap-1.5 border-t border-ui-divider pt-3">
            <div className="flex flex-wrap items-start justify-between gap-2 leading-[1.4]">
              <p className="m-0 text-[13px] font-semibold text-ui-body">
                {decided > 0 ? `${n(outcomes.won)} won · ${n(outcomes.lost)} lost · ${outcomes.winRatePct}% win rate` : 'Nothing has closed yet.'}
              </p>
              <p className={NOTE}>Win rate = won ÷ (won + lost)</p>
            </div>
            {data.closingsUndated > 0 && (
              <p className={NOTE}>{n(data.closingsUndated)} closed deals have no recorded close date, so they aren&apos;t in this chart.</p>
            )}
          </div>
        </section>
      </div>

      {/* Figma 210:24494 "Reporting notes" */}
      <div className="flex flex-wrap justify-between gap-2 text-[11px] leading-[1.4] text-ui-text-secondary">
        <span>All amounts in USD · Pipeline counted the same way as the CRM board</span>
        <span>Snapshot: {today}</span>
      </div>
    </div>
  );
}
