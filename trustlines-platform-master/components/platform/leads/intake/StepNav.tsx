'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS } from './types';

// Figma "Form progress" (node 290:36895): one row of equal step tabs; the active one is filled.
export function StepNav({ activeStep, onSelect }: { activeStep: number; onSelect: (step: number) => void }) {
  return (
    <nav aria-label="Intake steps" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {WIZARD_STEPS.map(s => {
        const isActive = activeStep === s.step;
        const isDone = activeStep > s.step;
        return (
          <button
            key={s.step}
            type="button"
            aria-current={isActive ? 'step' : undefined}
            onClick={() => onSelect(s.step)}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-[6px] border-0 px-2 py-3 text-left transition-colors',
              isActive ? 'bg-ui-selected-bg' : 'bg-ui-surface hover:bg-ui-hover-bg',
            )}
          >
            {/* Done = dark marker with a check (Figma 290:37148); active = dark marker + filled tab. */}
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
                isActive || isDone
                  ? 'bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950'
                  : 'bg-ui-input-bg text-ui-body',
              )}
            >
              {isDone ? <Check size={16} strokeWidth={2.5} aria-label="Done" /> : s.step}
            </span>
            <span className="flex min-w-0 flex-col text-[13px]">
              <span className={cn('truncate font-semibold', isActive || isDone ? 'text-[var(--color-secondary-700)] dark:text-ui-heading' : 'text-ui-body')}>
                {s.title}
              </span>
              <span className={cn('truncate', isActive || isDone ? 'text-ui-body' : 'text-ui-text-disabled')}>{s.subtitle}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
