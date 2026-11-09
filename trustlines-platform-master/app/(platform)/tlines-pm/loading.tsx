import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

// Dashboard-shaped placeholder — the same layout as the page (BranchBoard's heading,
// TopSummaryRow's greeting + tasks and KPI row, the 4 branch columns), so nothing jumps when the
// real content arrives.
export default function DashboardLoading() {
  return (
    <SkeletonGroup label="Loading the dashboard…">
      {/* Page heading */}
      <div className="mb-[30px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="flex items-end gap-3">
          <Skeleton className="h-9 w-[130px] rounded-[6px]" />
          <Skeleton className="h-9 w-[130px] rounded-[6px]" />
          <Skeleton className="h-9 w-[100px] rounded-[6px]" />
          <Skeleton className="h-9 w-[120px] rounded-[6px]" />
        </div>
      </div>

      {/* Greeting + tasks, then the KPI row */}
      <div className="mb-6 flex flex-col gap-[30px]">
        <div className="grid grid-cols-1 gap-[22px] xl:grid-cols-[minmax(0,527fr)_minmax(0,1011fr)]">
          <Skeleton className="h-[268px] w-full rounded-[10px]" />
          <div className="flex h-[268px] flex-col gap-3 rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-4">
            <Skeleton className="h-4 w-full" />
            {Array.from({ length: 6 }, (_, r) => <Skeleton key={r} className="h-3.5 w-full" />)}
          </div>
        </div>
        <div className="flex flex-wrap gap-[22px]">
          {Array.from({ length: 5 }, (_, k) => (
            <div key={k} className="flex min-w-0 flex-1 basis-[220px] flex-col gap-2 rounded-[16px] bg-ui-selected-bg py-3.5 pl-3.5 pr-4">
              <Skeleton className="size-[49px] rounded-[8px]" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Branch columns */}
      <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, c) => (
          <div key={c} className="flex flex-col gap-2.5 rounded-[16px] bg-ui-surface p-2.5">
            <Skeleton className="h-[105px] w-full rounded-[11px]" />
            <div className="flex flex-col gap-7 rounded-[11px] bg-ui-surface-elevated px-3 pb-3.5 pt-2">
              <Skeleton className="h-3 w-36" />
              {Array.from({ length: 3 }, (_, r) => (
                <div key={r} className="flex flex-col gap-2.5 rounded-[10px] border border-ui-divider bg-ui-surface p-4 pt-5">
                  <div className="flex justify-between gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-32 rounded-full" />
                  <div className="flex items-end justify-between gap-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-12 w-[150px] rounded-[8px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
