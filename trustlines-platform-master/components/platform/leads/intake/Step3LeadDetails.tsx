'use client';

import { LEAD_SOURCES } from '@/lib/sales/projectTypes';
import { Select } from '@/components/platform/shared/Select';
import { StepFooter } from './StepFooter';
import type { StepProps } from './types';

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
          <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
          <Select
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Assignee / Owner</label>
          <Select
            value={form.assignee_id}
            onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
          >
            <option value="">Unassigned</option>
            {assignees.map(a => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Deal size ($ USD)</label>
          <input
            type="number"
            placeholder="e.g. 50000"
            value={form.deal_size}
            onChange={e => setForm(f => ({ ...f, deal_size: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Lead source</label>
          <Select
            value={form.source}
            onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
          >
            <option value="">Select source...</option>
            {LEAD_SOURCES.map(ls => (
              <option key={ls} value={ls}>{ls}</option>
            ))}
          </Select>
        </div>
      </div>

      <StepFooter nextLabel="Continue to Scope of work" onBack={onBack} onNext={onNext} />
    </div>
  );
}
