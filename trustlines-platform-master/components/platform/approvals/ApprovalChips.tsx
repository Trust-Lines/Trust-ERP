import { ChevronsUp, ChevronsDown, Equal } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { PriorityLevel, StatusType } from './approvalsModel';

export function ApprovalStatusPill({ status }: { status: StatusType }) {
  // Tone + icon from lib/status/tags.ts (project_stage); chip spacing per design: 3px 10px 3px 8px, gap 4px.
  return (
    <StatusBadge
      group="project_stage"
      status={status}
      className="h-auto gap-1 rounded-[4px] py-[3px] pl-2 pr-[10px] text-xs leading-4 [&_svg]:size-3.5"
    />
  );
}

// Figma card priority: filled chip, chevrons + label (High t10, Medium t7, Low t0).
export function PriorityChip({ priority, small = false }: { priority: PriorityLevel; small?: boolean }) {
  const tone = priority === 'High' ? 't10' : priority === 'Medium' ? 't7' : 't0';
  const Icon = priority === 'High' ? ChevronsUp : priority === 'Medium' ? Equal : ChevronsDown;
  return (
    <span
      className={small ? 'inline-flex shrink-0 items-center gap-1 rounded-[4px] py-[3px] pl-2.5 pr-4 text-[12px] font-medium leading-4' : 'inline-flex h-[33px] shrink-0 items-center gap-1 rounded-[4px] pl-2 pr-2.5 text-[16px] leading-[1.4]'}
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
    >
      <Icon className={small ? 'size-3.5' : 'size-[17px]'} aria-hidden />{priority}
    </span>
  );
}

// Table priority: plain coloured label with chevrons.
export function PriorityLabel({ priority }: { priority: PriorityLevel }) {
  if (priority === 'High') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#dc2626] dark:text-error-light">
        <ChevronsUp className="w-3.5 h-3.5" />
        High
      </span>
    );
  }
  if (priority === 'Medium') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#475569] dark:text-ui-body">
        <Equal className="w-3.5 h-3.5" />
        Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#64748b] dark:text-ui-text-secondary">
      <ChevronsDown className="w-3.5 h-3.5" />
      Low
    </span>
  );
}
