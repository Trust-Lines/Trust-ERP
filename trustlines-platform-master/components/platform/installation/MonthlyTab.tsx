'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { byStart, fmtDate, headcount, monthKey, monthLabel, monthRows, type Installation } from '@/lib/installations/compute';
import { BranchChip, Empty, HEADING, ProjectNo, ScopeChip, Section, StatusPill, TD } from './shared';
import { Table } from './DashboardTab';

// The workbook's "Monthly Overview" sheet and its one-tab-per-month schedules (Nov 2026 …):
// counted by Planned Start, so a job spanning months sits in its start month.
export function MonthlyTab({ rows, months, today, projectByNo }: {
  rows: Installation[]; months: string[]; today: string; projectByNo: Record<string, string>;
}) {
  const overview = monthRows(rows, months);
  const [month, setMonth] = React.useState(() => months.includes(monthKey(today)) ? monthKey(today) : months[0]);
  const inMonth = rows.filter(r => r.planned_start && monthKey(r.planned_start) === month).sort(byStart);
  const people = inMonth.reduce((n, r) => n + headcount(r), 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Section title="Monthly installation overview" hint="click a month">
        <Table head={['Month', 'Starting', 'Confirmed', 'Tentative', 'In Progress', 'Completed']}>
          {overview.map(m => (
            <tr key={m.month} onClick={() => setMonth(m.month)}
              className={cn('cursor-pointer hover:bg-ui-hover-bg', m.month === month && 'bg-ui-selected-bg', m.starting === 0 && 'opacity-60')}>
              <td className={cn(TD, 'font-medium', m.month === month && 'font-bold text-ui-heading')}>{monthLabel(m.month)}</td>
              <td className={cn(TD, 'text-center font-semibold')}>{m.starting}</td>
              <td className={cn(TD, 'text-center')}>{m.confirmed}</td>
              <td className={cn(TD, 'text-center')}>{m.tentative}</td>
              <td className={cn(TD, 'text-center')}>{m.inProgress}</td>
              <td className={cn(TD, 'text-center')}>{m.completed}</td>
            </tr>
          ))}
        </Table>
        <p className="m-0 text-[11px] text-ui-text-secondary">A project spanning several months is counted in its start month only.</p>
      </Section>

      <Section title={`Installation schedule | ${monthLabel(month).toUpperCase()}`}>
        <div className="flex flex-wrap gap-6 text-[13px]">
          <span className="text-ui-body">Projects scheduled to start this month: <strong className={cn('text-[18px]', HEADING)}>{inMonth.length}</strong></span>
          <span className="text-ui-body">Total team members: <strong className={cn('text-[18px]', HEADING)}>{people}</strong></span>
        </div>
        {inMonth.length === 0 ? <Empty>Nothing starts this month.</Empty> : (
          <Table head={['Project #', 'Project / Store', 'Branch', 'City / State', 'Start', 'Finish', 'Assigned team', 'Members', 'Scope', 'Status']}>
            {inMonth.map(r => (
              <tr key={r.id}>
                <td className={TD}><ProjectNo row={r} projectByNo={projectByNo} /></td>
                <td className={TD}>{r.project_name}</td>
                <td className={TD}><BranchChip branch={r.branch} /></td>
                <td className={TD}>{r.city_state}</td>
                <td className={TD}>{fmtDate(r.planned_start)}</td>
                <td className={TD}>{fmtDate(r.planned_finish)}</td>
                <td className={cn(TD, 'whitespace-normal')}>{r.team || 'TBD'}</td>
                <td className={cn(TD, 'text-center font-semibold')}>{headcount(r)}</td>
                <td className={TD}><ScopeChip scope={r.scope} /></td>
                <td className={TD}><StatusPill status={r.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
