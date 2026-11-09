'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  BRANCHES, alertOf, countBy, dashboardStats, fmtDate, monthLabel, monthRows, needsAttention,
  startingWithin, statusTable, type Clash, type Installation,
} from '@/lib/installations/compute';
import { AlertPill, BRANCH_COLOR, BranchChip, Empty, HEADING, ProjectNo, Section, StatusPill, TD, TH } from './shared';

type Props = {
  rows: Installation[];
  today: string;
  clashes: Map<string, Clash[]>;
  months: string[];
  projectByNo: Record<string, string>;
  /** Jump to the register filtered to one problem (a KPI tile click). */
  onDrill: (filter: 'attention' | 'overdue' | 'clash' | 'update' | 'soon' | 'now' | null) => void;
};

// The workbook's Dashboard sheet, live: tiles, Needs attention, Installer double-booking,
// Starting in the next 30 days, By status / Assigned PM / By branch, and the two charts.
export function DashboardTab({ rows, today, clashes, months, projectByNo, onDrill }: Props) {
  const s = dashboardStats(rows, today, clashes);
  const attention = needsAttention(rows, today);
  const soon = startingWithin(rows, today, 30);
  const clashRows = rows.filter(r => clashes.has(r.id)).sort((a, b) => (a.planned_start ?? '').localeCompare(b.planned_start ?? ''));
  const perMonth = monthRows(rows, months);

  const tiles: { label: string; value: number; color: string; drill: Parameters<Props['onDrill']>[0] }[] = [
    { label: 'Active projects', value: s.active, color: '#1F4E79', drill: null },
    { label: 'Starting in 14 days', value: s.starting14, color: '#2E5BA3', drill: 'soon' },
    { label: 'Installing now', value: s.installingNow, color: '#4E7A2E', drill: 'now' },
    { label: 'Need attention', value: s.needAttention, color: '#C2570C', drill: 'attention' },
    { label: 'Overdue', value: s.overdue, color: '#C0262D', drill: 'overdue' },
    { label: 'Double-booked projects', value: s.doubleBooked, color: '#C0262D', drill: 'clash' },
    { label: 'Statuses to update', value: s.statusesToUpdate, color: '#C2570C', drill: 'update' },
    { label: 'Installers booked (14 days)', value: s.installersBooked14, color: '#1F4E79', drill: null },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[12px] text-ui-text-secondary">
        As of <strong className={HEADING}>{new Date(`${today}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</strong>
        {' · '}Everything updates from the Project Register.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(t => (
          <button
            key={t.label} type="button" disabled={!t.drill} onClick={() => onDrill(t.drill)}
            className={cn('flex flex-col overflow-hidden rounded-[10px] border border-ui-divider bg-ui-surface p-0 text-center', t.drill ? 'cursor-pointer transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.12)]' : 'cursor-default')}
            title={t.drill ? 'Show these in the register' : undefined}
          >
            <span className="px-2 py-1.5 text-[12px] font-semibold text-white" style={{ background: t.color }}>{t.label}</span>
            <span className="py-3 text-[32px] font-bold leading-none" style={{ color: t.value > 0 || !t.drill ? t.color : 'var(--ui-text-secondary)' }}>{t.value}</span>
          </button>
        ))}
      </div>

      <Section title="Needs attention" hint="sorted by start date">
        {attention.length === 0 ? <Empty>Nothing needs attention.</Empty> : (
          <Table head={['Project #', 'Project / Store', 'Branch', 'Start', 'Finish', 'Status', 'Alert']}>
            {attention.map(r => {
              const a = alertOf(r, today)!;
              return (
                <tr key={r.id}>
                  <td className={TD}><ProjectNo row={r} projectByNo={projectByNo} /></td>
                  <td className={TD}>{r.project_name}</td>
                  <td className={TD}><BranchChip branch={r.branch} /></td>
                  <td className={TD}>{fmtDate(r.planned_start)}</td>
                  <td className={TD}>{fmtDate(r.planned_finish)}</td>
                  <td className={TD}><StatusPill status={r.status} /></td>
                  <td className={TD}><AlertPill tone={a.tone} text={a.text} /></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Section>

      <Section title="Installer double-booking" hint="the same installer on two overlapping, active jobs">
        {clashRows.length === 0 ? <Empty>No installer is booked on overlapping projects.</Empty> : (
          <Table head={['Project #', 'Project / Store', 'Branch', 'Start', 'Finish', 'Clashes with #', 'Installers on two jobs at once']}>
            {clashRows.map(r => {
              const list = clashes.get(r.id)!;
              return (
                <tr key={r.id}>
                  <td className={TD}><ProjectNo row={r} projectByNo={projectByNo} /></td>
                  <td className={TD}>{r.project_name}</td>
                  <td className={TD}><BranchChip branch={r.branch} /></td>
                  <td className={TD}>{fmtDate(r.planned_start)}</td>
                  <td className={TD}>{fmtDate(r.planned_finish)}</td>
                  <td className={cn(TD, 'font-semibold text-[var(--status-t10-fg)]')}>{list.map(c => c.projectNo).join(', ')}</td>
                  <td className={cn(TD, 'whitespace-normal capitalize')}>{[...new Set(list.flatMap(c => c.people))].join(', ')}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Section>

      <Section title="Starting in the next 30 days">
        {soon.length === 0 ? <Empty>Nothing starts in the next 30 days.</Empty> : (
          <Table head={['Project #', 'Project / Store', 'Branch', 'Start', 'Finish', 'Assigned PM', 'Confidence', 'Assigned team']}>
            {soon.map(r => (
              <tr key={r.id}>
                <td className={TD}><ProjectNo row={r} projectByNo={projectByNo} /></td>
                <td className={TD}>{r.project_name}</td>
                <td className={TD}><BranchChip branch={r.branch} /></td>
                <td className={TD}>{fmtDate(r.planned_start)}</td>
                <td className={TD}>{fmtDate(r.planned_finish)}</td>
                <td className={TD}>{r.pm_name || '—'}</td>
                <td className={TD}>{r.confidence || '—'}</td>
                <td className={cn(TD, 'whitespace-normal')}>{r.team || 'TBD'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="By status" hint="entered vs. what the dates say">
          <Table head={['Status', 'Entered', 'Suggested']}>
            {statusTable(rows, today).map(x => (
              <tr key={x.status}>
                <td className={TD}><StatusPill status={x.status} /></td>
                <td className={cn(TD, 'text-right font-semibold')}>{x.entered}</td>
                <td className={cn(TD, 'text-right font-semibold', x.suggested !== x.entered && 'text-[#C2570C]')}>{x.suggested}</td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="Assigned PM" hint="open projects">
          <Table head={['PM', 'Projects', 'Installers']}>
            {countBy(rows, r => r.pm_name?.trim() || null).sort((a, b) => b.projects - a.projects).map(x => (
              <tr key={x.key}>
                <td className={cn(TD, x.key === 'Unassigned' && 'italic text-ui-text-secondary')}>{x.key}</td>
                <td className={cn(TD, 'text-right font-semibold')}>{x.projects}</td>
                <td className={cn(TD, 'text-right')}>{x.installers}</td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="By branch" hint="open projects">
          <Table head={['Branch', 'Projects', 'Installers']}>
            {countBy(rows, r => r.branch, BRANCHES).map(x => (
              <tr key={x.key}>
                <td className={TD}>{x.key === 'Unassigned' ? <span className="italic text-ui-text-secondary">No branch</span> : <BranchChip branch={x.key as never} />}</td>
                <td className={cn(TD, 'text-right font-semibold')}>{x.projects}</td>
                <td className={cn(TD, 'text-right')}>{x.installers}</td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Projects starting per month">
          <BarChart months={months} series={[{ key: 'Projects starting', color: '#2E5BA3', values: perMonth.map(m => m.starting) }]} />
        </Section>
        <Section title="Installer assignments per month by branch">
          <BarChart months={months} series={BRANCHES.map(b => ({ key: b, color: BRANCH_COLOR[b], values: perMonth.map(m => m.byBranch[b]) }))} />
        </Section>
      </div>
    </div>
  );
}

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

/** Stacked monthly columns (one series = plain bars), with a legend and hover totals. */
export function BarChart({ months, series }: { months: string[]; series: { key: string; color: string; values: number[] }[] }) {
  const totals = months.map((_, i) => series.reduce((n, s) => n + s.values[i], 0));
  const max = Math.max(1, ...totals);
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const W = 640, H = 220, L = 32, B = 34, T = 10;
  const colW = (W - L) / months.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map(s => s.key).join(', ')}>
        {Array.from({ length: top / step + 1 }, (_, k) => k * step).map(v => (
          <g key={v}>
            <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--ui-divider)" strokeWidth={1} />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--ui-text-secondary)">{v}</text>
          </g>
        ))}
        {months.map((m, i) => {
          let acc = 0;
          const x = L + i * colW + colW * 0.2;
          return (
            <g key={m}>
              <title>{`${monthLabel(m)}: ${series.map(s => `${s.key} ${s.values[i]}`).join(', ')}`}</title>
              {series.map(s => {
                const v = s.values[i];
                if (!v) return null;
                const y0 = y(acc), y1 = y(acc + v);
                acc += v;
                return <rect key={s.key} x={x} width={colW * 0.6} y={y1} height={y0 - y1} fill={s.color} rx={2} />;
              })}
              {totals[i] > 0 && <text x={x + colW * 0.3} y={y(totals[i]) - 3} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--ui-body)">{totals[i]}</text>}
              <text x={x + colW * 0.3} y={H - B + 14} textAnchor="middle" fontSize={10} fill="var(--ui-text-secondary)">{monthLabel(m, true)}</text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="flex flex-wrap justify-center gap-3 text-[11px] text-ui-body">
          {series.map(s => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px]" style={{ background: s.color }} />{s.key}</span>)}
        </div>
      )}
    </div>
  );
}
