'use client';

import { useMemo } from 'react';
import { byUrgency, isOpen, type MyTask } from '@/lib/myWorkspace/taskTypes';
import type { MyApproval } from '@/lib/approvals/mine';
import type { Installation } from '@/lib/installations/compute';
import {
  REGIONS, inRange, monthKey, monthsBetween, regionOf, startOf,
  type Container, type DashProject, type Loaded, type MonthBucket, type RegionKey,
} from './dashboardData';
import type { RegionSeries } from './Charts';

const countBy = (list: DashProject[], keys: string[], date: (p: DashProject) => string | null) =>
  list.filter(p => { const d = date(p); return !!d && keys.includes(monthKey(d)); }).length;

/** Everything the dashboard derives from the loaded data and the current filters. */
export function useDashboardStats({ projects, region, regionSeries, grouping, from, to, now, tasks, approvals, containers, installs }: {
  projects: DashProject[] | null;
  region: RegionKey | '';
  regionSeries: RegionKey | '';
  grouping: 'month' | 'quarter';
  from: Date;
  to: Date;
  now: Date;
  tasks: Loaded<MyTask>;
  approvals: Loaded<MyApproval>;
  containers: Loaded<Container>;
  installs: Loaded<Installation>;
}) {
  const scoped = useMemo(() => (projects ?? []).filter(p => !region || regionOf(p.region) === region), [projects, region]);
  const active = scoped.filter(p => p.current_stage !== 'delivered');
  const newInRange = scoped.filter(p => inRange(p.created_at, from, to)).length;
  const closed = scoped.filter(p => inRange(p.closed_deal_date, from, to));
  const inProduction = scoped.filter(p => p.current_stage === 'production');

  const months = useMemo(() => monthsBetween(from, to), [from, to]);
  const buckets = useMemo(() => {
    if (grouping === 'month') return months.map(m => ({ ...m, keys: [m.key] }));
    const out: (MonthBucket & { keys: string[] })[] = [];
    for (const m of months) {
      const q = Math.floor(Number(m.key.split('-')[1]) / 3);
      const k = `${m.year}-Q${q}`;
      const last = out[out.length - 1];
      if (last?.key === k) last.keys.push(m.key); else out.push({ key: k, mon: `Q${q + 1}`, year: m.year, keys: [m.key] });
    }
    return out;
  }, [months, grouping]);
  const barCounts = buckets.map(b => countBy(scoped, b.keys, startOf));
  const series: RegionSeries[] = REGIONS.filter(r => !regionSeries || r.key === regionSeries).map(r => ({
    key: r.key, label: r.label, color: r.color,
    values: months.map(m => countBy((projects ?? []).filter(p => regionOf(p.region) === r.key), [m.key], startOf)),
  }));

  const last6 = useMemo(() => Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return `${d.getFullYear()}-${d.getMonth()}`; }), [now]);
  const spark = (list: DashProject[], date: (p: DashProject) => string | null) => last6.map(k => countBy(list, [k], date));

  const openTasks = useMemo(() => (Array.isArray(tasks) ? tasks.filter(isOpen).sort(byUrgency) : []), [tasks]);
  const docs = Array.isArray(approvals) ? approvals : [];
  const po = docs.filter(a => a.docType === 'po_bo');
  const pf = docs.filter(a => a.docType === 'pf');
  const docState = approvals === null ? null : approvals === 'denied' ? 'error' as const : approvals;
  const upcoming = useMemo(() => (Array.isArray(containers) ? containers.filter(c => c.estimated_arrival_date)
    .sort((a, b) => (a.estimated_arrival_date ?? '').localeCompare(b.estimated_arrival_date ?? '')) : []), [containers]);
  const installRows = useMemo(() => (Array.isArray(installs) ? installs
    .filter(r => r.status !== 'Completed' && (!region || r.branch === region))
    .sort((a, b) => (a.planned_start ?? '9999').localeCompare(b.planned_start ?? '9999')) : []), [installs, region]);

  return {
    active, newInRange, closed, inProduction,
    months, buckets, barCounts, series,
    activeSpark: spark(scoped, p => p.created_at),
    closedSpark: spark(scoped, p => p.closed_deal_date),
    openTasks, po, pf, docState, upcoming, installRows,
  };
}
