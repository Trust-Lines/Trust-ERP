'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD, type ListState } from './dashboardData';

/** Figma list card (Containers / PO / PF / In Production / Installation / Design folders). */
export function ListCard({ title, icon, color, href, state, emptyText, children }: {
  title: string; icon: ReactNode; color: string; href: string;
  state: ListState; emptyText: string; children?: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn(CARD, 'flex min-w-0 flex-col pb-5 pt-3')}>
      <header className="flex items-center gap-2 border-b border-ui-divider px-5 pb-3" style={{ color }}>
        <span className="[&_svg]:size-[25px]" aria-hidden>{icon}</span>
        <h2 className="m-0 min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[0.4px]">{title}</h2>
        <Link href={href} className="inline-flex h-9 shrink-0 items-center rounded-[6px] border border-current bg-ui-surface-elevated px-2 text-[13px] font-medium no-underline transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring">
          View All<span className="sr-only">: {title}</span>
        </Link>
      </header>
      <div className="flex flex-col px-4 pt-2.5">
        {state === 'loading' && <p role="status" className="m-0 py-6 text-center text-[13px] text-ui-text-secondary">Loading…</p>}
        {state === 'error' && <p role="alert" className="m-0 py-6 text-center text-[13px] text-ui-text-secondary">Couldn’t load {title.toLowerCase()}. Refresh to try again.</p>}
        {state === 'empty' && <p className="m-0 py-6 text-center text-[13px] text-ui-text-secondary">{emptyText}</p>}
        {state === 'ready' && children}
      </div>
    </section>
  );
}

export function Row({ lead, title, sub, color, right, href, action = 'arrow', label }: {
  lead: ReactNode; title: string; sub: string; color: string; right?: ReactNode; href: string;
  action?: 'arrow' | 'none'; label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ui-divider py-2.5 pr-2 last:border-b-0" style={{ color }}>
      <span className="flex min-w-0 items-center gap-2.5">
        {lead}
        <span className="flex min-w-0 flex-col leading-normal">
          <span className="truncate text-[14px] font-semibold tracking-[-0.308px]">{title}</span>
          <span className="truncate text-[12px] tracking-[-0.264px] opacity-75">{sub}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-4">
        {right}
        {action === 'arrow' && (
          <Link href={href} aria-label={label} className="inline-flex size-[35px] items-center justify-center rounded-[6px] border border-current bg-ui-surface-elevated no-underline transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring" style={{ color }}>
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        )}
      </span>
    </div>
  );
}

export const CodeChip = ({ t, children }: { t: string; children: ReactNode }) => (
  <span className="inline-flex h-[35px] shrink-0 items-center rounded-[6px] px-2.5 text-[14px] font-semibold tracking-[-0.308px]" style={{ background: `var(--status-${t}-bg)`, color: `var(--status-${t}-fg)` }}>{children}</span>
);

// Solid pill text is the page background (Figma 985:12437 / dark 1019:30442): white in light, near-black in dark.
export const Pill = ({ solid, color, children }: { solid?: boolean; color: string; children: ReactNode }) => (
  <span className={cn('inline-flex h-[22px] items-center rounded-[4px] px-2.5 text-[12px] leading-[1.4]', solid ? 'text-ui-page-bg' : 'border border-current')}
    style={solid ? { background: color } : { color }}>{children}</span>
);
