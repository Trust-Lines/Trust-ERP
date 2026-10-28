'use client';

import type { ReactNode } from 'react';
import { CircleDashed, Pencil, Plus, Star, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Shared pieces for Figma "Customer detail" (node 304:2563).
export const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

/** Card shell: 8px radius, divider border, 20px title over a rule. `muted` = grey Details surface. */
export function DetailCard({ title, action, muted, className, children }: {
  title: string; action?: ReactNode; muted?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-5 rounded-[8px] border border-ui-divider px-5 pb-5 pt-4', muted ? 'bg-ui-surface' : 'bg-ui-page-bg', className)}>
      <div className="flex min-h-14 flex-col justify-center gap-4 border-b border-ui-divider pb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn('m-0 text-[20px] font-semibold leading-[1.35]', HEADING)}>{title}</h2>
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Orange "+ Add …" header button. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent pl-3.5 pr-6 text-[13px] font-medium text-ui-btn-accent-fg transition-opacity hover:opacity-90"
    >
      <Plus size={16} aria-hidden />
      {label}
    </button>
  );
}

/** 32px square row action: red-tinted delete, dark edit. */
export function IconAction({ kind, label, onClick }: { kind: 'delete' | 'edit'; label: string; onClick: () => void }) {
  const Icon = kind === 'delete' ? Trash2 : Pencil;
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={label}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[6px] border transition-opacity hover:opacity-85',
        kind === 'delete'
          ? 'border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]'
          : 'border-transparent bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950',
      )}
    >
      <Icon size={16} aria-hidden />
    </button>
  );
}

/** Small 18px status chip used inside rows. */
export function MiniChip({ tone, icon: Icon, star, children }: { tone: string; icon?: LucideIcon; star?: boolean; children: ReactNode }) {
  return (
    <span
      className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[4px] pl-2 pr-2.5 text-[11px] font-medium leading-4 whitespace-nowrap"
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
    >
      {star && <Star size={10} fill="currentColor" strokeWidth={0} aria-hidden />}
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  );
}

export const PrimaryChip = () => <MiniChip tone="t7" star>Primary</MiniChip>;
export const ApproverChip = () => <MiniChip tone="t5" icon={CircleDashed}>Approver</MiniChip>;

/** Divided list of rows. */
export function RowList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-ui-divider [&>*:last-child]:border-b [&>*:last-child]:border-ui-divider">{children}</div>;
}

/** Inline add/edit form container. */
export const FORM_BOX = 'rounded-[6px] border border-ui-divider bg-ui-surface px-3.5 py-3';
