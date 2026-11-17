import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PageCrumbs, type CrumbItem } from './PageCrumbs';

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

/**
 * Page heading: crumbs, 28px title, subtitle, actions on the right.
 * `className` styles the outer row, `bodyClassName` the crumbs/title/subtitle column.
 */
export function PageHeading({ trail, title, titleAdornment, subtitle, actions, className, bodyClassName }: {
  trail: string | CrumbItem[]; title: string; subtitle: ReactNode; actions?: ReactNode;
  /** Rendered right after the title on the same line (e.g. a count pill). */
  titleAdornment?: ReactNode;
  className?: string; bodyClassName?: string;
}) {
  const heading = <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>{title}</h1>;
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className={cn('flex flex-col gap-[5px] leading-[1.35]', bodyClassName)}>
        <PageCrumbs items={typeof trail === 'string' ? [{ label: trail }] : trail} />
        {titleAdornment ? <div className="flex items-center gap-2">{heading}{titleAdornment}</div> : heading}
        <p className="m-0 text-[13px] text-ui-body">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
