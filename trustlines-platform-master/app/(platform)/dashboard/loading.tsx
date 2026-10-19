import { Briefcase, CircleCheck, ClipboardList } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

// Dashboard-shaped placeholder (KPI row + branch columns) instead of the generic table skeleton
// in app/(platform)/loading.tsx, so the page doesn't jump when the real content arrives.
export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.5fr)]">
        <KpiCard loading icon={<CircleCheck />} label="Approvals" value={0} />
        <KpiCard loading icon={<Briefcase />} label="Active projects" value={0} />
        <KpiCard loading tone="muted" icon={<ClipboardList />} label="My Day" value={0} className="sm:col-span-2 xl:col-span-1" />
      </div>

      <SkeletonGroup label="Loading branches…" className="mb-4">
        <Skeleton className="h-14 w-full rounded-card" />
      </SkeletonGroup>

      <SkeletonGroup label="Loading branches…" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, c) => (
          <div key={c} className="overflow-hidden rounded-card border border-ui-divider bg-ui-surface-elevated shadow-01">
            <Skeleton className="h-28 w-full rounded-none" />
            <div className="space-y-3.5 p-3.5">
              {Array.from({ length: 5 }, (_, r) => (
                <div key={r} className="space-y-2 rounded-control bg-primary-50 dark:bg-primary-800 p-3.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </SkeletonGroup>
    </div>
  );
}
