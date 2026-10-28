'use client';

import { StepFooter } from './StepFooter';
import type { StepProps } from './types';
import { Checkbox } from '@/components/ui/checkbox';

export function Step4ScopeOfWork({ form, setForm, onBack, onNext, onSaveDraft }: StepProps) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Scope of work</h2>
        <p className="mt-1 text-[13px] text-ui-body">Select trade disciplines requested by customer.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['shelving', 'millwork', 'image', 'ceiling'] as const).map(trade => (
          <label
            key={trade}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
              form.scope_of_work[trade]
                ? 'border-[var(--color-secondary-700)] bg-ui-selected-bg text-[var(--color-secondary-700)] font-semibold dark:border-ui-heading dark:text-ui-heading'
                : 'border-[var(--ui-input-border)] bg-ui-input-bg text-ui-body hover:bg-ui-hover-bg'
            }`}
          >
            <Checkbox
              checked={form.scope_of_work[trade]}
              onCheckedChange={checked => setForm(f => ({ ...f, scope_of_work: { ...f.scope_of_work, [trade]: checked } }))}
              className="mb-2"
            />
            <span className="text-xs capitalize">{trade}</span>
          </label>
        ))}
      </div>

      <StepFooter onBack={onBack} onNext={onNext} onSaveDraft={onSaveDraft} />
    </div>
  );
}
