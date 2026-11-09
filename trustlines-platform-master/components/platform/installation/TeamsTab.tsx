'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  BRANCHES, byStart, fmtDate, headcount, installersOf, isActive, monthLabel, monthRows, type Clash, type Installation,
} from '@/lib/installations/compute';
import { BranchChip, Empty, ProjectNo, Section, StatusPill, TD } from './shared';
import { Table } from './DashboardTab';

// The workbook's "Team Allocation" sheet (monthly head count by branch + project-by-project team
// list), plus what the sheet couldn't do: every installer's own jobs and clashes.
export function TeamsTab({ rows, months, today, clashes, projectByNo }: {
  rows: Installation[]; months: string[]; today: string; clashes: Map<string, Clash[]>; projectByNo: Record<string, string>;
}) {
  const perMonth = monthRows(rows, months);
  const sorted = [...rows].sort(byStart);

  // Installer → their active jobs (from the names in each team).
  const people = new Map<string, Installation[]>();
  for (const r of rows) {
    if (!isActive(r)) continue;
    for (const p of installersOf(r.team)) people.set(p, [...(people.get(p) ?? []), r]);
  }
  const installers = [...people.entries()]
    .map(([name, jobs]) => ({ name, jobs: jobs.sort(byStart), clash: jobs.some(j => clashes.get(j.id)?.some(c => c.people.includes(name))) }))
    .sort((a, b) => Number(b.clash) - Number(a.clash) || b.jobs.length - a.jobs.length || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <Section title="Monthly team allocation summary" hint="head count of projects starting each month">
        <Table head={['Month', 'Projects starting', 'Total project assignments*', ...BRANCHES]}>
          {perMonth.map(m => (
            <tr key={m.month} className={cn(m.starting === 0 && 'opacity-60')}>
              <td className={cn(TD, 'font-medium')}>{monthLabel(m.month)}</td>
              <td className={cn(TD, 'text-center font-semibold')}>{m.starting}</td>
              <td className={cn(TD, 'text-center font-semibold')}>{m.assignments}</td>
              {BRANCHES.map(b => <td key={b} className={cn(TD, 'text-center')}>{m.byBranch[b]}</td>)}
            </tr>
          ))}
        </Table>
        <p className="m-0 text-[11px] text-ui-text-secondary">
          * The sum of head counts across projects starting that month. An installer on two projects is counted twice — the
          Installers list below and the Dashboard show the overlaps.
        </p>
      </Section>

      <Section title="Installers" hint={`${installers.length} named on active jobs · today ${fmtDate(today)}`}>
        {installers.length === 0 ? <Empty>No team lists its installers yet — write them in brackets, e.g. “TEAM B (Terrence, Robert)”.</Empty> : (
          <div className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
            {installers.map(p => (
              <div key={p.name} className={cn('flex flex-col gap-1.5 rounded-[8px] border p-3', p.clash ? 'border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)]/40' : 'border-ui-divider bg-ui-page-bg')}>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold capitalize text-ui-heading">{p.name}</span>
                  <span className="text-[11px] text-ui-text-secondary">{p.jobs.length} job{p.jobs.length === 1 ? '' : 's'}</span>
                  {p.clash && <span className="ml-auto rounded-full bg-[var(--status-t10-fg)] px-2 py-0.5 text-[10px] font-bold text-white">DOUBLE-BOOKED</span>}
                </div>
                {p.jobs.map(j => (
                  <div key={j.id} className="flex items-center gap-2 text-[11px] text-ui-body">
                    <ProjectNo row={j} projectByNo={projectByNo} />
                    <span className="truncate">{j.project_name}</span>
                    <span className="ml-auto whitespace-nowrap">{fmtDate(j.planned_start)} – {fmtDate(j.planned_finish)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Project-by-project team list">
        <Table head={['Project #', 'Project / Store', 'Branch', 'Start', 'Finish', 'Assigned team', 'Members', 'Status']}>
          {sorted.map(r => (
            <tr key={r.id}>
              <td className={TD}><ProjectNo row={r} projectByNo={projectByNo} /></td>
              <td className={TD}>{r.project_name}</td>
              <td className={TD}><BranchChip branch={r.branch} /></td>
              <td className={TD}>{fmtDate(r.planned_start)}</td>
              <td className={TD}>{fmtDate(r.planned_finish)}</td>
              <td className={cn(TD, 'whitespace-normal', clashes.has(r.id) && 'font-semibold text-[var(--status-t10-fg)]')}>{r.team || 'TBD'}</td>
              <td className={cn(TD, 'text-center font-semibold')}>{headcount(r)}</td>
              <td className={TD}><StatusPill status={r.status} /></td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
