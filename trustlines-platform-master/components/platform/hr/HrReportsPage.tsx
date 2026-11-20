'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChartNoAxesCombined, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { HEADING } from '@/components/platform/shared/panelStyles';
import { DEPARTMENT_LABELS, type Department } from '@/lib/profile/metadata';
import { LATE_GRACE_MIN, reportCsv, shiftMonth, type HrReport, type PersonReport } from '@/lib/hr/reports';
import { cn } from '@/lib/utils';
import { HrPageHeader } from './HrPages';

// HR → Reports: one month of attendance and leave per person, plus headcount. Numbers come from
// buildReport (lib/hr/reports) over the mobile app's punches, shifts and requests.

const TH = 'px-2.5 py-3 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
const TD = 'px-2.5 py-3 text-[13px] whitespace-nowrap text-ui-body tabular-nums';
const NAV_BTN = 'inline-flex size-10 items-center justify-center rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg text-ui-heading no-underline hover:opacity-90';

const deptLabel = (d: string | null) => (d ? DEPARTMENT_LABELS[d as Department] ?? d : 'No department');
const roleText = (r: string | null) => (r ? roleLabel(r) : 'No role');
const monthLabel = (m: string) =>
  new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortMonth = (m: string) =>
  new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
const sum = (rows: PersonReport[], k: keyof PersonReport) => rows.reduce((n, r) => n + (r[k] as number), 0);

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-5">
      <header className={cn('flex items-center gap-2', HEADING)}>
        <ChartNoAxesCombined size={22} strokeWidth={1.5} aria-hidden />
        <h2 className="m-0 text-[18px] font-semibold">{title}</h2>
      </header>
      <p className="m-0 text-[13px] text-ui-body">{description}</p>
      {children}
    </section>
  );
}

function Stats({ items }: { items: { label: string; value: string | number; hint?: string }[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map(i => (
        <div key={i.label} className="flex flex-col gap-0.5" title={i.hint}>
          <dt className="text-[12px] text-ui-body">{i.label}</dt>
          <dd className={cn('m-0 text-[22px] font-semibold tabular-nums leading-tight', HEADING)}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: { label: string; count: number }[]; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className={cn('m-0 text-[14px] font-semibold', HEADING)}>{title}</h3>
      {rows.length === 0 ? <p className="m-0 text-[13px] text-ui-body">—</p> : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map(r => (
            <li key={r.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-[13px] text-ui-body">
                <span className="truncate">{r.label}</span>
                <span className="tabular-nums">{r.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-700" aria-hidden>
                <div className="h-full rounded-full bg-ui-btn-accent" style={{ width: `${total ? (r.count / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HrReportsPage({ report, scope, missingTables }: {
  report: HrReport;
  scope: 'all' | 'team';
  missingTables: boolean;
}) {
  const { month, people, headcount } = report;
  const year = month.slice(0, 4);

  function exportCsv() {
    const csv = reportCsv(report, p => ({ role: roleText(p.role), department: deptLabel(p.department) }));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxTrend = Math.max(1, ...headcount.trend.map(t => t.count));

  return (
    <div className="flex flex-col gap-6">
      <HrPageHeader
        title="Reports"
        href="/hr/reports"
        subtitle={scope === 'all' ? 'Attendance, leave and headcount for everyone.' : 'Attendance, leave and headcount for the people who report to you.'}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/hr/reports?month=${shiftMonth(month, -1)}`} className={NAV_BTN} aria-label="Previous month">
              <ChevronLeft size={16} aria-hidden />
            </Link>
            <span className={cn('min-w-[130px] text-center text-[14px] font-semibold', HEADING)}>{monthLabel(month)}</span>
            <Link href={`/hr/reports?month=${shiftMonth(month, 1)}`} className={NAV_BTN} aria-label="Next month">
              <ChevronRight size={16} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              disabled={people.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-5 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90 disabled:opacity-50"
            >
              <Download size={16} aria-hidden /> Export CSV
            </button>
          </div>
        }
      />

      {missingTables && (
        <p className="m-0 rounded-[6px] border border-ui-divider bg-ui-surface-elevated px-4 py-3 text-[13px] text-ui-body">
          Some HR tables are missing — run migrations 144_time_punches.sql and 145_hr_and_warehouse.sql in Supabase.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Attendance" description="Days present, absent and late per person.">
          <Stats items={[
            { label: 'Days present', value: sum(people, 'present') },
            { label: 'Hours worked', value: Math.round(sum(people, 'hours')) },
            { label: 'Late', value: sum(people, 'late'), hint: `First clock-in more than ${LATE_GRACE_MIN} min after the planned shift start` },
            { label: 'Absent', value: sum(people, 'absent'), hint: 'Planned shift days with no clock-in and no approved leave' },
          ]} />
        </Card>
        <Card title="Leave" description="Sick days and vacation taken this month.">
          <Stats items={[
            { label: 'Vacation days', value: sum(people, 'vacation') },
            { label: 'Sick days', value: sum(people, 'sick') },
            { label: 'Personal days', value: sum(people, 'personal') },
            { label: 'Pending requests', value: sum(people, 'pending') },
          ]} />
        </Card>
        <Card title="Headcount" description="Staff by team and role over time.">
          <Stats items={[
            { label: 'Active staff', value: headcount.active },
            { label: 'Joined this month', value: headcount.joinedThisMonth },
          ]} />
          <div className="flex h-[72px] items-end gap-2" role="img" aria-label={`Active staff over the last 6 months: ${headcount.trend.map(t => `${shortMonth(t.month)} ${t.count}`).join(', ')}`}>
            {headcount.trend.map(t => (
              <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] tabular-nums text-ui-body">{t.count}</span>
                <div className="w-full rounded-t-[3px] bg-ui-btn-accent" style={{ height: `${Math.max(4, (t.count / maxTrend) * 40)}px` }} />
                <span className="text-[11px] text-ui-body">{shortMonth(t.month)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <section aria-label="By person" className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
        {people.length === 0 ? (
          <EmptyState size="sm" title="No one to report on." description={scope === 'team' ? 'Nobody reports to you yet.' : 'No active staff.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                  <th scope="col" className={cn(TH, 'pl-[18px]')}>Name</th>
                  <th scope="col" className={TH}>Department</th>
                  <th scope="col" className={TH}>Present</th>
                  <th scope="col" className={TH}>Hours</th>
                  <th scope="col" className={TH} title="Days with a planned shift">Planned</th>
                  <th scope="col" className={TH}>Late</th>
                  <th scope="col" className={TH}>Absent</th>
                  <th scope="col" className={TH}>Vacation</th>
                  <th scope="col" className={TH}>Sick</th>
                  <th scope="col" className={TH}>Personal</th>
                  <th scope="col" className={TH}>Vacation {year}</th>
                  <th scope="col" className={cn(TH, 'pr-[18px]')}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {people.map(p => (
                  <tr key={p.id} className="border-b border-ui-divider last:border-b-0">
                    <td className="py-2.5 pl-[18px] pr-2.5">
                      <div className="flex flex-col leading-[1.4]">
                        <Link href={`/team/${p.id}`} className={cn('text-[14px] font-semibold no-underline hover:underline', HEADING)}>{p.name}</Link>
                        <span className="text-[11px] text-ui-body">{roleText(p.role)}</span>
                      </div>
                    </td>
                    <td className={TD}>{deptLabel(p.department)}</td>
                    <td className={TD}>{p.present}</td>
                    <td className={TD}>{p.hours}</td>
                    <td className={TD}>{p.planned}</td>
                    <td className={cn(TD, p.late > 0 && 'font-semibold text-[var(--color-warning-normal)]')}>{p.late}</td>
                    <td className={cn(TD, p.absent > 0 && 'font-semibold text-[var(--color-error-normal)]')}>{p.absent}</td>
                    <td className={TD}>{p.vacation}</td>
                    <td className={TD}>{p.sick}</td>
                    <td className={TD}>{p.personal}</td>
                    <td className={TD}>{p.vacationYear}</td>
                    <td className={cn(TD, 'pr-[18px]')}>{p.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Headcount breakdown" className="grid grid-cols-1 gap-6 rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-5 md:grid-cols-2">
        <Breakdown title="By department" total={headcount.active} rows={headcount.byDepartment.map(r => ({ label: deptLabel(r.key || null), count: r.count }))} />
        <Breakdown title="By role" total={headcount.active} rows={headcount.byRole.map(r => ({ label: roleText(r.key || null), count: r.count }))} />
      </section>

      <p className="m-0 text-[12px] text-ui-body">
        Days are counted in each person&apos;s office time zone. Late and absent are only counted on days with a planned shift.
        Leave days are calendar days of approved requests.{headcount.inactive > 0 ? ` ${headcount.inactive} inactive profile${headcount.inactive === 1 ? '' : 's'} not counted.` : ''}
      </p>
    </div>
  );
}
