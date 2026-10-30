import { Fragment } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface CrumbItem {
  label: string;
  /** No href = plain text, for a part that isn't a page of its own. */
  href?: string;
  /** For a crumb on the same route that has to reset page state (e.g. leave an editor). */
  onClick?: () => void;
}

const LINK = 'text-inherit no-underline hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';

/** The "Sales / CRM Board" trail above a page title; every part with an href is a link. */
export function PageCrumbs({ items, className }: { items: CrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-[11px] font-semibold text-ui-nav-active', className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {item.href
              ? <Link href={item.href} onClick={item.onClick} aria-current={last ? 'page' : undefined} className={LINK}>{item.label}</Link>
              : <span>{item.label}</span>}
            {!last && ' / '}
          </Fragment>
        );
      })}
    </nav>
  );
}
