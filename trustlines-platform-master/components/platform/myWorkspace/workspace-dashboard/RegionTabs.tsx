'use client';

import { Select } from '@/components/ui/select';
import { BranchLogo } from '@/components/platform/dashboard/BranchLogo';
import { cn } from '@/lib/utils';
import { CARD, REGIONS, type RegionKey } from './dashboardData';

export function RegionTabs({ region, onRegionChange }: {
  region: RegionKey | '';
  onRegionChange: (region: RegionKey | '') => void;
}) {
  return (
    <div className={cn(CARD, 'flex flex-wrap items-center gap-2 p-1.5')} role="group" aria-label="Region">
      {REGIONS.map(r => (
        <button key={r.key} type="button" aria-pressed={region === r.key} onClick={() => onRegionChange(region === r.key ? '' : r.key)}
          className={cn('flex h-9 min-w-[120px] flex-1 cursor-pointer items-center justify-center rounded-[6px] border-0 transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring',
            region && region !== r.key ? 'opacity-45 hover:opacity-80' : 'hover:opacity-90', region === r.key && 'ring-2 ring-offset-2 ring-offset-ui-surface-elevated')}
          style={{ background: r.color, ['--tw-ring-color' as string]: r.color }}>
          {/* Figma 818:37269 + 818:37281: the TLines mark over the region name */}
          <BranchLogo code={r.key} height={30} />
        </button>
      ))}
      <Select aria-label="Regions" className="h-9 w-[130px]" value={region}
        options={[{ value: '', label: 'Regions' }, ...REGIONS.map(r => ({ value: r.key, label: r.key }))]}
        onValueChange={v => onRegionChange((v ?? '') as RegionKey | '')} />
    </div>
  );
}
