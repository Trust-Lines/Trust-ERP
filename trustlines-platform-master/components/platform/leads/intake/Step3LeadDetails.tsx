'use client';

import { LEAD_SOURCES } from '@/lib/sales/projectTypes';
import { StepFooter } from './StepFooter';
import { FIELD_CLS } from './Step1ProjectSetup';
import type { StepProps } from './types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const LABEL_CLS = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';

/** "13000.5" → "13,000.5" for display; the form keeps the raw number string. */
function groupThousands(raw: string): string {
  if (!raw) return '';
  const [int, dec] = raw.split('.');
  const grouped = (int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}

// Figma "New lead · Lead details" (node 290:35041): two rows of two 42px fields.
// The frame's 4th field reads "Contact Email" (already asked on the Customer step); the lead
// source is what the Lead Preview shows, so that field stays here.
export function Step3LeadDetails({ form, setForm, onBack, onNext, onSaveDraft, assignees }: StepProps & {
  assignees: { id: string; full_name: string }[];
}) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h2 className="m-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Lead details</h2>
        <p className="mt-1 text-[13px] text-ui-body">Set priority, sales owner, and deal expectations.</p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
        <div>
          <label htmlFor="intake-priority" className={LABEL_CLS}>Priority</label>
          <Select
            id="intake-priority" className={FIELD_CLS} placeholder="Select"
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
          <label htmlFor="intake-assignee" className={LABEL_CLS}>Assignee/Owner</label>
          <Select
            id="intake-assignee" className={FIELD_CLS} placeholder="Select"
            value={form.assignee_id}
            onValueChange={v => setForm(f => ({ ...f, assignee_id: v ?? '' }))}
            options={[{ value: '', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))]}
          />
        </div>
        <div>
          <label htmlFor="intake-deal-size" className={LABEL_CLS}>Deal size ($ USD)</label>
          <Input
            id="intake-deal-size" type="text" inputMode="decimal" className={FIELD_CLS} placeholder="type.."
            value={groupThousands(form.deal_size)}
            onChange={e => {
              const raw = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
              setForm(f => ({ ...f, deal_size: raw }));
            }}
          />
        </div>
        <div>
          <label htmlFor="intake-source" className={LABEL_CLS}>Lead source</label>
          <Select
            id="intake-source" className={FIELD_CLS} placeholder="Select"
            value={form.source}
            onValueChange={v => setForm(f => ({ ...f, source: v ?? '' }))}
            options={LEAD_SOURCES.map(ls => ({ value: ls, label: ls }))}
          />
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} onSaveDraft={onSaveDraft} />
    </div>
  );
}
