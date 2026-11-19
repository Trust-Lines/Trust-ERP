'use client';

import { Archive, Search, User } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { REGIONS } from '@/lib/regions';
import { cn } from '@/lib/utils';
import { STATUS_META, type OpportunityStatus } from '../types';
import { FILTER_CLS, PRIORITY_OPTIONS, UNASSIGNED, type Assignee } from './boardConfig';

/** Left side of the toolbar: search, priority / assignee / region, Mine, archived, stage chip. */
export function BoardFilters({
  search, onSearchChange, priority, onPriorityChange, assignee, onAssigneeChange, assignees, region, onRegionChange,
  mine, onToggleMine, myCount, showArchived, onToggleArchived, archivedCount, selectedStage, onClearStage,
}: {
  search: string; onSearchChange: (v: string) => void;
  priority: string; onPriorityChange: (v: string) => void;
  assignee: string; onAssigneeChange: (v: string) => void; assignees: Assignee[];
  region: string; onRegionChange: (v: string) => void;
  mine: boolean; onToggleMine: () => void; myCount: number;
  showArchived: boolean; onToggleArchived: () => void; archivedCount: number;
  selectedStage: OpportunityStatus | null; onClearStage: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative w-[285px] max-w-full">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
        <input
          type="search"
          aria-label="Search records"
          placeholder="Search name, brand, project #…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
        />
      </div>

      <Select aria-label="Priority" className={FILTER_CLS} value={priority} onValueChange={v => onPriorityChange(v ?? '')} options={PRIORITY_OPTIONS} />

      <Select
        aria-label="Assignee"
        className={FILTER_CLS}
        value={assignee}
        onValueChange={v => onAssigneeChange(v ?? '')}
        options={[
          { value: '', label: 'Assignee' },
          { value: UNASSIGNED, label: 'Unassigned' },
          ...assignees.map(a => ({ value: a.id, label: a.full_name })),
        ]}
      />

      <Select
        aria-label="Region"
        className={FILTER_CLS}
        value={region}
        onValueChange={v => onRegionChange(v ?? '')}
        options={[{ value: '', label: 'Regions' }, ...REGIONS.map(r => ({ value: r.code, label: r.label }))]}
      />

      {/* A filter toggle, not a view — so a pressed button. */}
      <button
        type="button"
        aria-pressed={mine}
        onClick={onToggleMine}
        className={cn(FILTER_CLS, 'pr-3 aria-pressed:border-[var(--color-secondary-700)] aria-pressed:bg-ui-selected-bg dark:aria-pressed:border-ui-heading')}
      >
        <User aria-hidden />
        Mine · {myCount}
      </button>

      {archivedCount > 0 && (
        <button
          type="button"
          aria-pressed={showArchived}
          onClick={onToggleArchived}
          className={cn(FILTER_CLS, 'pr-3 aria-pressed:bg-ui-selected-bg')}
        >
          <Archive aria-hidden />
          {showArchived ? 'Hide' : 'Show'} archived · {archivedCount}
        </button>
      )}

      {selectedStage && (
        <button type="button" onClick={onClearStage} className="text-[13px] font-medium text-ui-link hover:underline">
          Clear “{STATUS_META[selectedStage].label}” filter
        </button>
      )}
    </div>
  );
}
