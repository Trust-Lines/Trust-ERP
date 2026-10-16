import { Briefcase, CircleCheck } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { MyDayCard } from './MyDayCard';

// Top row of the dashboard, laid out like Ahmet's Figma (DAY 02 › Approval › Dashboard):
// two KPI cards (Approvals, Projects) + one wide card with a list (here: My Day).

export interface ApprovalSummaryItem {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  docType: string;
  stage: number;
}

export function TopSummaryRow({ approvals, activeCount, overdueCount, newThisWeek }: {
  approvals: ApprovalSummaryItem[]; activeCount: number; overdueCount: number; newThisWeek: number;
}) {
  // Overdue is the more urgent signal; fall back to "new this week" when nothing is late.
  const projectsBadge = overdueCount > 0
    ? { label: `${overdueCount} overdue`, tone: 'error' as const }
    : newThisWeek > 0
      ? { label: `+${newThisWeek} this week`, tone: 'success' as const }
      : undefined;

  return (
    <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.5fr)]">
      <KpiCard
        href="/approvals"
        icon={<CircleCheck />}
        label="Approvals"
        value={approvals.length}
        badge={approvals.length > 0 ? { label: 'Pending', tone: 'warning' } : undefined}
      />
      <KpiCard href="/projects" icon={<Briefcase />} label="Active projects" value={activeCount} badge={projectsBadge} />
      <MyDayCard className="sm:col-span-2 xl:col-span-1" />
    </div>
  );
}
