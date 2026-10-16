'use client';

import { LEAD_SOURCES } from '@/lib/sales/projectTypes';
import { StepFooter } from './StepFooter';
import type { StepProps } from './types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function Step3LeadDetails({ form, setForm, onBack, onNext, assignees }: StepProps & {
  assignees: { id: string; full_name: string }[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Lead details</h2>
        <p className="text-xs text-slate-500 mt-0.5">Set priority, sales owner, and deal expectations.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label htmlFor="intake-priority" className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
          <Select
            id="intake-priority"
            value={form.priority}
            onValueChange={v => setForm(f => ({ ...f, priority: v ?? f.priority }))}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>

        <div>
          <label htmlFor="intake-assignee" className="block text-xs font-semibold text-slate-700 mb-1">Assignee / Owner</label>
          <Select
            id="intake-assignee"
            value={form.assignee_id}
            onValueChange={v => setForm(f => ({ ...f, assignee_id: v ?? '' }))}
            options={[{ value: '', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Deal size ($ USD)</label>
          <Input
            type="number"
            placeholder="e.g. 50000"
            value={form.deal_size}
            onChange={e => setForm(f => ({ ...f, deal_size: e.target.value }))}
          />
        </div>

        <div>
          <label htmlFor="intake-source" className="block text-xs font-semibold text-slate-700 mb-1">Lead source</label>
          <Select
            id="intake-source"
            placeholder="Select source..."
            value={form.source}
            onValueChange={v => setForm(f => ({ ...f, source: v ?? '' }))}
            options={LEAD_SOURCES.map(ls => ({ value: ls, label: ls }))}
          />
        </div>
      </div>

      <StepFooter nextLabel="Continue to Scope of work" onBack={onBack} onNext={onNext} />
    </div>
  );
}
