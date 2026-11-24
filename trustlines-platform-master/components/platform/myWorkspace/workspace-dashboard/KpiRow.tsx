'use client';

import { BriefcaseBusiness, CircleCheck, ClipboardPenLine, UserRound } from 'lucide-react';
import { StatTile as Kpi } from '@/components/platform/dashboard/StatTile';
import type { MyApproval } from '@/lib/approvals/mine';
import { PRESETS, fmtDay, type Loaded } from './dashboardData';
import type { OpportunityTotal } from './useDashboardData';

// Figma 985:12437: the tiles carry no sparkline any more.
export function KpiRow({
  activeCount, inProductionCount, newInRange, closedCount,
  showOpportunities, opportunities, approvals, poCount, pfCount, preset, from, to,
}: {
  activeCount: number;
  inProductionCount: number;
  newInRange: number;
  closedCount: number;
  showOpportunities: boolean;
  opportunities: OpportunityTotal;
  approvals: Loaded<MyApproval>;
  poCount: number;
  pfCount: number;
  preset: string;
  from: Date;
  to: Date;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-4">
      <Kpi label="Active Projects" value={activeCount} icon={<BriefcaseBusiness strokeWidth={1.5} />} color="var(--ui-btn-solid)" onColor="var(--ui-surface-elevated)"
        sub={`${inProductionCount} in production`} badge={newInRange ? `+${newInRange} New` : undefined} href="/projects" />
      {showOpportunities && opportunities !== 'denied' && (
        <Kpi label="Total Clients Opportunity" value={typeof opportunities === 'number' ? opportunities : opportunities === null ? '…' : '—'} icon={<UserRound strokeWidth={1.5} />}
          color="var(--status-t4-fg)" onColor="var(--status-t4-bg)" sub="Key clients’ open deals" href="/tlines-pm" />
      )}
      <Kpi label="Deals Closed" value={closedCount} icon={<CircleCheck strokeWidth={1.5} />} color="var(--status-t6-fg)" onColor="var(--status-t6-bg)"
        sub={`${PRESETS.find(p => p.value === preset)?.label ?? `${fmtDay(from)} – ${fmtDay(to)}`}`} href="/projects" />
      <Kpi label="Waiting for my approval" value={Array.isArray(approvals) ? approvals.length : approvals === null ? '…' : '—'} icon={<ClipboardPenLine strokeWidth={1.5} />}
        color="var(--status-t9-fg)" onColor="var(--status-t9-bg)" sub={`${poCount} PO · ${pfCount} PF`} href="/workspace/approvals" />
    </div>
  );
}
