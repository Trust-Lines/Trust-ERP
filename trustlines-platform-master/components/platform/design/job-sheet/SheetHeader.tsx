'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { ChevronsUp, X } from 'lucide-react';
import type { SalesDesignJob } from '@/types/database';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { HEADING } from '../designShared';
import { CHIP } from './sheetShared';

/** Dialog title + subtitle, status and High-priority chips, close button. */
export function SheetHeader({ title, subtitle, job }: { title: string; subtitle: string; job: SalesDesignJob }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col">
          {subtitle && <DialogPrimitive.Description className="m-0 truncate text-[16px] text-ui-text-secondary">{subtitle}</DialogPrimitive.Description>}
          <DialogPrimitive.Title className={cn('m-0 text-[22px] font-semibold leading-[1.25] sm:text-[28px]', HEADING)}>{title}</DialogPrimitive.Title>
        </div>
        <div className="flex flex-wrap items-start gap-[5px]">
          <StatusBadge group="design_job" status={job.status} className={CHIP} />
          {job.priority === 'high' && (
            <span className={cn('inline-flex items-center rounded-[4px] font-medium', CHIP)} style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>
              <ChevronsUp aria-hidden /> High
            </span>
          )}
        </div>
      </div>
      <DialogPrimitive.Close render={<Button variant="ghost" size="icon-md" aria-label="Close" className={cn('-mr-1 shrink-0 [&_svg]:size-8', HEADING)} />}>
        <X strokeWidth={1.5} />
      </DialogPrimitive.Close>
    </div>
  );
}
