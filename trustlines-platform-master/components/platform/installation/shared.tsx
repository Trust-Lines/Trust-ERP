'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AlertTone, Branch, InstallStatus, Installation } from '@/lib/installations/compute';
import { projectNumber } from '@/lib/keyClients/match';

// Same branch colours as the T-Lines PM board's column headers (tlines-pm/page.tsx).
export const BRANCH_COLOR: Record<Branch, string> = { NE: '#465B6D', SE: '#3B472B', NW: '#2E5BA3', CVW: '#7A655E' };
// The workbook's scope fills: Store Maker green, Premium purple, Design & Build orange.
export const SCOPE_COLOR: Record<string, string> = { 'STORE MAKER': '#5F7A2E', 'PREMIUM FIT OUT': '#5B4A8B', 'DESIGN AND BUILD': '#C2570C' };

export const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
export const CARD = 'rounded-[10px] border border-ui-divider bg-ui-surface';
export const TH = 'sticky top-0 z-[1] whitespace-nowrap bg-[var(--color-secondary-700)] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-white dark:bg-primary-700';
export const TD = 'whitespace-nowrap border-b border-ui-divider px-2.5 py-1.5 text-[12px] text-ui-body';

const TONE: Record<AlertTone, string> = {
  red: 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]',
  amber: 'bg-[#FFF1D6] text-[#8A5A00] dark:bg-[#5C4410] dark:text-[#FFE2A8]',
  blue: 'bg-[var(--status-t2-bg)] text-[var(--status-t2-fg)]',
};
export const STATUS_TONE: Record<InstallStatus, string> = {
  'Not Started': 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]',
  'In Progress': 'bg-[var(--status-t2-bg)] text-[var(--status-t2-fg)]',
  Completed: 'bg-[#DDF3E2] text-[#1E6B33] dark:bg-[#1E6B33] dark:text-[#DDF3E2]',
  Delayed: 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]',
  'On Hold': 'bg-[#FFF1D6] text-[#8A5A00] dark:bg-[#5C4410] dark:text-[#FFE2A8]',
};

export function Pill({ tone, children, className }: { tone: string; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-semibold', tone, className)}>{children}</span>;
}
export const AlertPill = ({ tone, text }: { tone: AlertTone; text: string }) => <Pill tone={TONE[tone]}>{text}</Pill>;
export const StatusPill = ({ status }: { status: InstallStatus | null }) =>
  status ? <Pill tone={STATUS_TONE[status]}>{status}</Pill> : <span className="text-ui-text-secondary">—</span>;

export function BranchChip({ branch }: { branch: Branch | null }) {
  if (!branch) return <span className="text-ui-text-secondary">—</span>;
  return <span className="inline-flex h-5 min-w-9 items-center justify-center rounded-[4px] px-1.5 text-[11px] font-bold text-white" style={{ background: BRANCH_COLOR[branch] }}>{branch}</span>;
}
export function ScopeChip({ scope }: { scope: string | null }) {
  if (!scope) return <span className="text-ui-text-secondary">—</span>;
  const c = SCOPE_COLOR[scope.toUpperCase()];
  return c
    ? <span className="inline-flex h-5 items-center rounded-[4px] px-1.5 text-[10px] font-bold uppercase text-white" style={{ background: c }}>{scope}</span>
    : <span className="text-[12px]">{scope}</span>;
}

/** "#480 STG 1" — links to the project when the number matches one in the app. */
export function ProjectNo({ row, projectByNo }: { row: Pick<Installation, 'project_no'>; projectByNo: Record<string, string> }) {
  const no = projectNumber(row.project_no);
  const id = no ? projectByNo[no] : undefined;
  const text = row.project_no || '—';
  return id
    ? <Link href={`/projects/${id}`} className="font-semibold text-[var(--color-secondary-700)] underline-offset-2 hover:underline dark:text-ui-heading">{text}</Link>
    : <span className="font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">{text}</span>;
}

export function Section({ title, hint, children, actions }: { title: string; hint?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={cn(CARD, 'flex min-w-0 flex-col gap-3 p-4')}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={cn('m-0 text-[15px] font-semibold uppercase tracking-[0.3px]', HEADING)}>{title}</h2>
        {hint && <span className="text-[11px] text-ui-text-secondary">{hint}</span>}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 rounded-[8px] bg-ui-page-bg px-3 py-4 text-center text-[12px] italic text-ui-text-secondary">{children}</p>;
}
