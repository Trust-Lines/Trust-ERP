'use client';

import { StepFooter } from './StepFooter';
import type { StepProps } from './types';
import { Checkbox } from '@/components/ui/checkbox';

export function Step4ScopeOfWork({ form, setForm, onBack, onNext }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Scope of work</h2>
        <p className="text-xs text-slate-500 mt-0.5">Select trade disciplines requested by customer.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['shelving', 'millwork', 'image', 'ceiling'] as const).map(trade => (
          <label
            key={trade}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
              form.scope_of_work[trade]
                ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-bold'
                : 'border-slate-200 bg-ui-surface-elevated text-slate-700 hover:bg-slate-50'
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

      <StepFooter nextLabel="Continue to Additional notes" onBack={onBack} onNext={onNext} />
    </div>
  );
}
