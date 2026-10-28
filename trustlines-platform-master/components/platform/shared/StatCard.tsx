import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

/** Figma KPI card (Marketing Home 244:17297, CRM Board 280:25017): 165px tile, icon square, label, big value, optional chip. */
export function StatCard({ icon: Icon, label, value, chip, href }: { icon: LucideIcon; label: string; value: ReactNode; chip?: string; href?: string }) {
  const body = (
    <>
      <span aria-hidden className="grid size-[49px] place-items-center rounded-control bg-ui-surface-elevated">
        <Icon className={cn('size-6', HEADING)} />
      </span>
      <div className="flex w-full flex-col gap-1 pl-0.5">
        <span className={cn('text-[14px] leading-[1.5] tracking-[-0.308px]', HEADING)}>{label}</span>
        <div className="flex items-center justify-between gap-3">
          <span className={cn('text-[30px] font-semibold leading-[25px] tracking-[0.6px] tabular-nums', HEADING)}>{value}</span>
          {chip && (
            <span className={cn('rounded-tag bg-ui-surface-elevated px-2.5 py-0.5 text-[14px] font-medium leading-[1.5] tracking-[0.56px] whitespace-nowrap', HEADING)}>
              {chip}
            </span>
          )}
        </div>
      </div>
    </>
  );
  const cls = 'flex h-[165px] flex-col justify-between rounded-modal bg-ui-selected-bg py-3.5 pl-3.5 pr-4 text-inherit no-underline';
  return href ? (
    <Link
      href={href}
      className={cn(cls, 'outline-none transition-shadow hover:shadow-03 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring')}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
