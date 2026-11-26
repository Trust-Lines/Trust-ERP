'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Contact pop-up and dashboard card pop-up: the same three steps hanging from the top edge.
// Figma "Prospect detail" (1025:11136): three steps hanging from the top edge. Client Info and After
// Closed show the tabbed contact view (After Closed has no frame of its own yet); Before Closed the
// tasks + needs view. Steps before the open one read done (green), after it upcoming (grey, dashed).
export type ContactStep = 'client' | 'before' | 'after';
type Step = ContactStep;
export const CONTACT_STEPS: { key: Step; label: string }[] = [
  { key: 'client', label: 'Client Info' },
  { key: 'before', label: 'Before Closed' },
  { key: 'after', label: 'After Closed' },
];

export function StepStrip({ step, onStep, flush, disabled = [] }: {
  step: Step;
  onStep: (s: Step) => void;
  flush?: boolean;
  /** Steps that can't open here (e.g. Client Info on a card with no Contact). */
  disabled?: Step[];
}) {
  const at = CONTACT_STEPS.findIndex(s => s.key === step);
  return (
    // flush: in the pop-up the tabs hang from its top edge (it pads 32px).
    <nav aria-label="Contact steps" className={cn('flex shrink-0 flex-wrap justify-center gap-4', flush && '-mt-8')}>
      {CONTACT_STEPS.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'upcoming';
        return (
          <button
            key={s.key} type="button" onClick={() => onStep(s.key)} disabled={disabled.includes(s.key)} aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'flex w-[220px] cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50 justify-center gap-2.5 rounded-b-[10px] border-0 px-2 py-3 text-[16px]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring',
              state === 'done' && 'bg-[var(--status-t9-bg)] text-[var(--status-t9-fg)]',
              state === 'current' && 'bg-ui-btn-primary font-semibold text-ui-btn-primary-fg',
              state === 'upcoming' && 'bg-[var(--status-t0-bg)] text-ui-body',
            )}
          >
            {state === 'done' && (
              <span aria-hidden className="grid size-6 place-items-center rounded-full bg-[var(--status-t9-fg)] text-[var(--status-t9-bg)]"><Check size={16} /></span>
            )}
            {state === 'current' && <span aria-hidden className="size-6 rounded-full bg-ui-btn-primary-fg" />}
            {state === 'upcoming' && <span aria-hidden className="size-6 rounded-full border-[1.5px] border-dashed border-current" />}
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

