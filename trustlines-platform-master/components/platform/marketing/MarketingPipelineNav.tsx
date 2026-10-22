'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Props {
  current: 'prospects' | 'potentials' | 'opportunities';
  prospectCount: number | null;
  potentialCount: number | null;
  opportunityCount: number | null;
}

// 🔴 2026-09-17: "Opportunities" dropped from this strip — it's Sales's board now
// (marketing_pr is hard-blocked from /marketing/opportunities, see that page's role gate),
// and this component only ever renders on the Contacts page. Contacts → Potentials only.
const SEGMENTS = [
  { key: 'prospects' as const, href: '/marketing/prospects', label: 'Contacts' },
  { key: 'potentials' as const, href: '/marketing/opportunities', label: 'Potentials' },
];

function countFor(key: Props['current'], p: Props): string {
  const n = key === 'prospects' ? p.prospectCount : key === 'potentials' ? p.potentialCount : p.opportunityCount;
  return n === null ? '' : String(n);
}

// Figma Contacts (TASK 52) "Saved views": underline tabs, 48px tall, 3px active border.
export function MarketingPipelineNav(props: Props) {
  return (
    <nav aria-label="Marketing pipeline" className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
      {SEGMENTS.map(s => {
        const isCurrent = s.key === props.current;
        const count = countFor(s.key, props);
        const inner = (
          <>
            {s.label}
            {count !== '' && <span className="text-[11px] opacity-75">({count})</span>}
          </>
        );
        const cls = cn(
          'flex items-center gap-1.5 border-b-[3px] text-[13px] leading-[1.4] no-underline',
          isCurrent
            ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
            : 'border-transparent text-ui-text-secondary hover:text-ui-body',
        );
        return isCurrent ? (
          <span key={s.key} aria-current="page" className={cls}>{inner}</span>
        ) : (
          <Link key={s.key} href={s.href} className={cls}>{inner}</Link>
        );
      })}
    </nav>
  );
}
