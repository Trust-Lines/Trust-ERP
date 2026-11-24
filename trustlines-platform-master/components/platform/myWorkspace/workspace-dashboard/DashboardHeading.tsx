'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { HEADING } from '@/components/platform/shared/panelStyles';
import { cn } from '@/lib/utils';
import { PRESETS, REGIONS, fmtDay, presetRange, type RegionKey } from './dashboardData';

/** Title, breadcrumbs, the From / To / region / preset filters and Create task (Figma 985:12437). */
export function DashboardHeading({ from, to, preset, region, canCreateTask, onPresetChange, onRangeChange, onRegionChange }: {
  from: Date;
  to: Date;
  preset: string;
  region: RegionKey | '';
  canCreateTask: boolean;
  onPresetChange: (preset: string) => void;
  onRangeChange: (range: [Date, Date]) => void;
  onRegionChange: (region: RegionKey | '') => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'My Workspace', href: '/workspace' }, { label: 'Dashboard', href: '/workspace' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Dashboard</h1>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-[11px] text-ui-text-secondary">From
          <DatePicker aria-label="From date" value={from} formatValue={fmtDay} className="h-9 w-[150px]"
            onValueChange={d => { if (d) { onPresetChange(''); onRangeChange([d, d > to ? d : to]); } }} />
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] text-ui-text-secondary">To
          <DatePicker aria-label="To date" value={to} formatValue={fmtDay} className="h-9 w-[150px]"
            onValueChange={d => { if (d) { onPresetChange(''); onRangeChange([d < from ? d : from, d]); } }} />
        </label>
        <Select aria-label="Region" className="h-9 w-[130px]" value={region}
          options={[{ value: '', label: 'All Regions' }, ...REGIONS.map(r => ({ value: r.key, label: r.key }))]}
          onValueChange={v => onRegionChange((v ?? '') as RegionKey | '')} />
        <Select aria-label="Date range" className="h-9 w-[140px]" value={preset}
          options={preset ? PRESETS : [{ value: '', label: 'Custom' }, ...PRESETS]}
          onValueChange={v => { if (v) { onPresetChange(v); onRangeChange(presetRange(v)); } }} />
        {canCreateTask && (
          <Link href="/sales-tasks" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-ui-btn-accent px-3 text-[13px] font-medium text-ui-btn-accent-fg no-underline hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring">
            <Plus size={16} aria-hidden /> Create task
          </Link>
        )}
      </div>
    </div>
  );
}
