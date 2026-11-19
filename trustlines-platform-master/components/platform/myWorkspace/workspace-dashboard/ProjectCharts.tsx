'use client';

import { Select } from '@/components/ui/select';
import { HEADING } from '@/components/platform/shared/panelStyles';
import { cn } from '@/lib/utils';
import { REGIONS, type MonthBucket, type RegionKey } from './dashboardData';
import { AreaChart, BarChart, type RegionSeries } from './Charts';

export function ProjectCharts({ grouping, onGroupingChange, buckets, barCounts, months, series, regionSeries, onRegionSeriesChange }: {
  grouping: 'month' | 'quarter';
  onGroupingChange: (g: 'month' | 'quarter') => void;
  buckets: MonthBucket[];
  barCounts: number[];
  months: MonthBucket[];
  series: RegionSeries[];
  regionSeries: RegionKey | '';
  onRegionSeriesChange: (r: RegionKey | '') => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,726fr)_minmax(0,1050fr)]">
      <section aria-label="Total Projects starting per month" className="flex min-w-0 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface-elevated px-6 pb-8 pt-6">
        <header className="flex items-center justify-between gap-3">
          <h2 className={cn('m-0 text-[20px] font-semibold leading-[30px]', HEADING)}>Total Projects starting per {grouping}</h2>
          <Select aria-label="Group by" className="h-9 w-[120px]" value={grouping}
            options={[{ value: 'month', label: 'Monthly' }, { value: 'quarter', label: 'Quarterly' }]}
            onValueChange={v => v && onGroupingChange(v as 'month' | 'quarter')} />
        </header>
        <BarChart months={buckets} counts={barCounts} />
        <p className="sr-only">{buckets.map((b, i) => `${b.mon} ${b.year}: ${barCounts[i]}`).join(', ')}</p>
      </section>
      <section aria-label="Projects per month by Region" className="flex min-w-0 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface-elevated px-6 pb-6 pt-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={cn('m-0 text-[20px] font-semibold leading-[30px]', HEADING)}>Projects per month by Region</h2>
          <Select aria-label="Regions shown" className="h-9 w-[150px]" value={regionSeries}
            options={[{ value: '', label: 'All Regions' }, ...REGIONS.map(r => ({ value: r.key, label: r.key }))]}
            onValueChange={v => onRegionSeriesChange((v ?? '') as RegionKey | '')} />
        </header>
        <AreaChart months={months} series={series} />
        <ul className="m-0 flex list-none justify-center gap-4 p-0 text-[12px] text-ui-text-secondary">
          {series.map(s => <li key={s.key} className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full" style={{ background: s.color }} />{s.key}</li>)}
        </ul>
        <p className="sr-only">{series.map(s => `${s.key}: ${months.map((m, i) => `${m.mon} ${m.year} ${s.values[i]}`).join(', ')}`).join('. ')}</p>
      </section>
    </div>
  );
}
