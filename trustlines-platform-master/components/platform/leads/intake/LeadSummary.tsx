'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Figma "Lead Preview" (node 290:37006): grey card, project-code badge, then what's filled in so far.
export function LeadSummary({ projectCode, rows, missing }: {
  projectCode: string | null;
  rows: { label: string; value: string | null }[];
  /** Required fields still empty — "Create lead" stays locked until this is empty. */
  missing: string[];
}) {
  return (
    <aside className="flex flex-col gap-[26px] rounded-[8px] border border-ui-divider bg-ui-surface p-5">
      <div className="flex flex-col items-start gap-1">
        <h3 className="m-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Lead Preview</h3>
        <span className="rounded-[4px] bg-[var(--color-secondary-700)] px-3 py-0.5 text-[12px] font-semibold leading-[1.5] tracking-[-0.264px] text-white dark:bg-primary-50 dark:text-primary-950">
          {projectCode ? `# ${projectCode}` : '-'}
        </span>
      </div>

      {rows.map(r => (
        <div key={r.label} className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium leading-4 text-ui-body">{r.label}</span>
          <span className={cn('break-words text-[14px] font-medium leading-[1.5] tracking-[-0.308px]', r.value ? 'text-[var(--color-secondary-700)] dark:text-ui-heading' : 'text-ui-text-disabled')}>
            {r.value || '-'}
          </span>
        </div>
      ))}

      <div className="border-t border-ui-divider pt-4 text-[12px] leading-4">
        {missing.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--status-t9-fg)]">
            <Check size={14} aria-hidden /> Ready to create
          </span>
        ) : (
          <span className="text-ui-text-secondary">Still needed to create: {missing.join(' · ')}</span>
        )}
      </div>
    </aside>
  );
}
