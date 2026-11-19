'use client';

import { useState } from 'react';
import { todayKey } from '@/lib/myWorkspace/taskTypes';
import { presetRange, type DashProject, type DashboardAccess, type DesignDoc, type RegionKey } from './workspace-dashboard/dashboardData';
import { useDashboardData } from './workspace-dashboard/useDashboardData';
import { useDashboardStats } from './workspace-dashboard/useDashboardStats';
import { DashboardHeading } from './workspace-dashboard/DashboardHeading';
import { RegionTabs } from './workspace-dashboard/RegionTabs';
import { GreetingCard } from './workspace-dashboard/GreetingCard';
import { MyTasksCard } from './workspace-dashboard/MyTasksCard';
import { KpiRow } from './workspace-dashboard/KpiRow';
import { ShippingApprovalCards } from './workspace-dashboard/ShippingApprovalCards';
import { ProjectCharts } from './workspace-dashboard/ProjectCharts';
import { OperationsCards } from './workspace-dashboard/OperationsCards';

export type { DashProject, DesignDoc } from './workspace-dashboard/dashboardData';

// My Workspace → Overview, Figma "General Manager_Dashboard" (node 714:35213).
// Every number comes from data the person can already open; a panel whose source this role
// can't read is left out instead of showing an empty or made-up list.
//   projects, design docs   the page (the person's RLS client)
//   everything else         useDashboardData (client-side API calls)
export function WorkspaceDashboard({ userName, role, projects, designDocs, access }: {
  userName: string; role: string; projects: DashProject[] | null; designDocs: DesignDoc[] | null;
  access: DashboardAccess;
}) {
  const [preset, setPreset] = useState('year');
  const [[from, to], setRange] = useState<[Date, Date]>(() => presetRange('year'));
  const [region, setRegion] = useState<RegionKey | ''>('');
  const [regionSeries, setRegionSeries] = useState<RegionKey | ''>('');
  const [grouping, setGrouping] = useState<'month' | 'quarter'>('month');
  const [now] = useState(() => new Date());
  const [today] = useState(() => todayKey());

  const { tasks, approvals, containers, installs, opportunities, toggleTask } = useDashboardData(access);
  const s = useDashboardStats({ projects, region, regionSeries, grouping, from, to, now, tasks, approvals, containers, installs });
  const showProjects = access.projects && !!projects;

  return (
    <div className="flex flex-col gap-5">
      <DashboardHeading from={from} to={to} preset={preset} onPresetChange={setPreset} onRangeChange={setRange} />

      <RegionTabs region={region} onRegionChange={setRegion} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,527fr)_minmax(0,1245fr)]">
        <GreetingCard userName={userName} role={role} now={now} />
        <MyTasksCard tasks={tasks} openTasks={s.openTasks} today={today} onToggle={(t, done) => void toggleTask(t, done)} />
      </div>

      {showProjects && (
        <KpiRow
          activeCount={s.active.length}
          inProductionCount={s.inProduction.length}
          newInRange={s.newInRange}
          activeSpark={s.activeSpark}
          closedCount={s.closed.length}
          closedSpark={s.closedSpark}
          showOpportunities={access.opportunities}
          opportunities={opportunities}
          approvals={approvals}
          poCount={s.po.length}
          pfCount={s.pf.length}
          preset={preset}
          from={from}
          to={to}
        />
      )}

      <ShippingApprovalCards containers={containers} upcoming={s.upcoming} docState={s.docState} po={s.po} pf={s.pf} now={now} />

      {showProjects && (
        <ProjectCharts
          grouping={grouping}
          onGroupingChange={setGrouping}
          buckets={s.buckets}
          barCounts={s.barCounts}
          months={s.months}
          series={s.series}
          regionSeries={regionSeries}
          onRegionSeriesChange={setRegionSeries}
        />
      )}

      <OperationsCards
        access={access}
        projects={projects}
        inProduction={s.inProduction}
        installs={installs}
        installRows={s.installRows}
        designDocs={designDocs}
      />
    </div>
  );
}
