'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';

// Figma "New lead" step navigation (nodes 290:36998, 290:37214): outlined "← Back" (or "Cancel") on the
// left; optional outlined "Save as draft" and a dark "Next →" on the right. Sits at the bottom of the card.
export const FOOTER_SECONDARY = 'inline-flex h-9 items-center gap-[7px] rounded-[6px] border border-ui-divider bg-ui-input-bg px-8 text-[13px] font-medium text-ui-body transition-colors hover:bg-ui-hover-bg';
export const FOOTER_OUTLINE = 'inline-flex h-9 items-center rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent px-8 text-[13px] font-medium text-[var(--color-secondary-700)] transition-colors hover:bg-ui-hover-bg disabled:opacity-60 dark:border-ui-heading dark:text-ui-heading';
export const FOOTER_PRIMARY = 'inline-flex h-9 items-center gap-[7px] rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-8 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950';

/** Footer shared by the wizard steps. Pass `backLabel="Cancel"` on step 1 (no arrow). */
export function StepFooter({ nextLabel = 'Next', backLabel = 'Back', onBack, onNext, onSaveDraft }: {
  nextLabel?: string; backLabel?: string; onBack: () => void; onNext: () => void; onSaveDraft?: () => void;
}) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
      <button type="button" onClick={onBack} className={FOOTER_SECONDARY}>
        {backLabel === 'Back' && <ArrowLeft size={16} aria-hidden />}
        {backLabel}
      </button>
      <div className="flex items-center gap-2">
        {onSaveDraft && <button type="button" onClick={onSaveDraft} className={FOOTER_OUTLINE}>Save as draft</button>}
        <button type="button" onClick={onNext} className={FOOTER_PRIMARY}>
          {nextLabel}
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
