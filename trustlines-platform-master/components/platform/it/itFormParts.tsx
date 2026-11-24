'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The IT form system (Figma 845:42033, the item page style) — one place for every IT add / edit
// dialog (items, phone numbers, subscriptions): grey "main surface" panels with a title, white
// "elevated" inputs on them, 12px labels, and the Cancel / primary footer.

export const LABEL = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
export const PRIMARY_BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-secondary-700 px-6 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-secondary-50 dark:text-primary-950';
export const SECONDARY_BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--ui-input-border)] bg-transparent px-6 text-[13px] font-medium text-ui-heading hover:bg-ui-hover-bg';

export const FORM_PANEL = 'flex flex-col gap-4 rounded-lg border border-solid border-primary-100 bg-primary-50 px-5 pb-6 pt-4 dark:border-primary-600 dark:bg-primary-700';
export const PANEL_TITLE = 'm-0 text-[18px] font-semibold leading-normal text-secondary-700 dark:text-secondary-50';
/** Input / Select on a panel. */
export const FORM_FIELD = 'h-[42px] w-full border-primary-100 bg-white text-[14px] dark:border-transparent dark:bg-secondary-800';
export const FORM_TEXTAREA = 'min-h-0 w-full border-primary-100 bg-white text-[14px] dark:border-transparent dark:bg-secondary-800';

/** A titled grey panel. `aside` sits right of the title (e.g. "stored encrypted"). */
export function FormPanel({ id, title, aside, className, children }: {
  id: string; title: string; aside?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={cn(FORM_PANEL, className)} aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className={PANEL_TITLE}>{title}</h3>
        {aside && <span className="text-[12px] text-ui-text-secondary">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Label + control (+ hint). */
export function FormField({ id, label, required, hint, className, children }: {
  id: string; label: string; required?: boolean; hint?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className={LABEL}>
        {label}{required && <span className="text-error-normal" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ui-text-secondary">{hint}</span>}
    </div>
  );
}

/** Cancel + submit row under the panels. */
export function FormActions({ saving, onCancel, submitLabel }: { saving: boolean; onCancel: () => void; submitLabel: ReactNode }) {
  return (
    <div className="flex justify-end gap-2 border-t border-ui-divider pt-4">
      <button type="button" onClick={onCancel} disabled={saving} className={SECONDARY_BTN}>Cancel</button>
      <button type="submit" disabled={saving} className={PRIMARY_BTN}>{saving ? 'Saving…' : submitLabel}</button>
    </div>
  );
}

/** Read-only value on a panel (e.g. a date the system sets). */
export function FormValue({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[42px] items-center rounded-md border border-primary-100 bg-white/60 px-3 text-[14px] text-ui-body dark:border-transparent dark:bg-secondary-800/60">
      {children}
    </div>
  );
}
