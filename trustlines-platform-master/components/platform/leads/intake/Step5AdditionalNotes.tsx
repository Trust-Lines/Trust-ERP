'use client';

import { StepFooter } from './StepFooter';
import type { StepProps } from './types';
import { Textarea } from '@/components/ui/textarea';

export function Step5AdditionalNotes({ form, setForm, onBack, onNext }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Additional notes</h2>
        <p className="text-xs text-slate-500 mt-0.5">Area details & customer specific requests.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Target Areas / Rooms</label>
        <Textarea
          rows={3}
          placeholder="e.g. Sales floor, backroom, drive-thru counter..."
          value={form.notes.areas}
          onChange={e => setForm(f => ({ ...f, notes: { ...f.notes, areas: e.target.value } }))}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Client Special Requests</label>
        <Textarea
          rows={3}
          placeholder="Any special material or timing requirements..."
          value={form.notes.client_special_request}
          onChange={e => setForm(f => ({ ...f, notes: { ...f.notes, client_special_request: e.target.value } }))}
        />
      </div>

      <StepFooter nextLabel="Continue to Dimensions & media" onBack={onBack} onNext={onNext} />
    </div>
  );
}
