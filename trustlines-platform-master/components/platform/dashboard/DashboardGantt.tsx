'use client';

import * as React from 'react';
import { SquareChartGantt } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { doubleBookings, planMonths, resolveTeams, type InstallTeam, type Installation } from '@/lib/installations/compute';
import type { GanttStageData } from '@/lib/installations/ganttData';
import { LifecycleGantt } from '@/components/platform/installation/LifecycleGantt';

/** What the server hands the dashboard's Gantt view (only when it is open and allowed). */
export interface DashboardGanttData extends GanttStageData {
  rows: Installation[];
  teams: InstallTeam[];
  today: string;
  /** Why the plan couldn't be read (migration 142 missing, …). */
  error: string | null;
}

// /dashboard → "View as Gantt chart": the installation plan's projects with their whole life
// (opportunity → production → shipped → installation → completed), the chart that used to be the
// Gantt tab of /tlines-pm/installation. Follows the board's Branches pick and date range.
export function DashboardGantt({ data, branches, from, to }: {
  data: DashboardGanttData | null;
  /** Branch codes (NE / SE / NW / CVW) picked in the Branches filter; empty = every branch. */
  branches: string[];
  from: string;
  to: string;
}) {
  const rows = React.useMemo(() => (data ? resolveTeams(data.rows, data.teams) : []), [data]);
  const clashes = React.useMemo(() => doubleBookings(rows), [rows]);
  const months = React.useMemo(() => planMonths(rows), [rows]);
  const visible = React.useMemo(() => rows.filter(r => {
    if (branches.length && (!r.branch || !branches.includes(r.branch))) return false;
    if (from || to) {
      const s = r.planned_start, f = r.planned_finish ?? r.planned_start;
      if (!s || !f) return false;
      if (from && f < from) return false;
      if (to && s > to) return false;
    }
    return true;
  }), [rows, branches, from, to]);

  if (!data) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-[8px] border border-ui-divider bg-ui-page-bg p-4" aria-label="Loading the Gantt chart">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-[41px] animate-pulse rounded-[4px] bg-ui-surface" />)}
      </div>
    );
  }
  if (data.error) {
    return (
      <p role="alert" className="m-0 rounded-[8px] px-3 py-2 text-[13px] font-medium" style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>
        {data.error}
      </p>
    );
  }
  if (rows.length === 0) {
    return <EmptyState boxed icon={<SquareChartGantt />} title="No projects in the installation plan yet" description="Projects added on T-Lines PM → Installation Plan show up here." />;
  }
  return (
    <LifecycleGantt rows={visible} months={months} today={data.today} clashes={clashes}
      projectByNo={data.projectByNo} milestonesByNo={data.milestonesByNo} undatedByNo={data.undatedByNo} />
  );
}
