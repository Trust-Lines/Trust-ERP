'use client';

import Link from 'next/link';
import { Palette, Plus } from 'lucide-react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { HEADING } from '@/components/platform/shared/panelStyles';
import { cn } from '@/lib/utils';

export function BoardHeading({ total }: { total: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Sales & Marketing', href: '/leads' }, { label: 'CRM Board', href: '/leads' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>CRM Board</h1>
        <p className="text-[13px] text-ui-body">
          {total} records
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Designs the designer sent to Sales ("Send to Sales") — was its own sidebar link. */}
        <Link
          href="/design?scope=review"
          className="inline-flex h-9 items-center gap-2 rounded-[6px] px-3 text-[13px] font-medium leading-[1.35] text-[var(--color-secondary-700)] no-underline transition-colors hover:bg-ui-hover-bg dark:text-ui-heading [&_svg]:size-4"
        >
          <Palette aria-hidden />
          Design Reviews
        </Link>
        <Link
          href="/leads/new"
          className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] pl-3 pr-5 text-[13px] font-medium leading-[1.35] text-[var(--color-secondary-700)] no-underline transition-colors hover:bg-ui-hover-bg dark:border-ui-heading dark:text-ui-heading [&_svg]:size-4"
        >
          <Plus aria-hidden />
          Opportunity
        </Link>
        <Link
          href="/leads/new?view=quick_deal"
          className="inline-flex h-9 items-center rounded-[6px] bg-ui-btn-accent px-8 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg no-underline transition-opacity hover:opacity-90"
        >
          Quick Deal
        </Link>
      </div>
    </div>
  );
}
