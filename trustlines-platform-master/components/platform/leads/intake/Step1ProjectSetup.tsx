'use client';

import { US_STATES } from '@/lib/usStates';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { PROJECT_TYPES } from '@/lib/sales/projectTypes';
import type { FormState, SetForm } from './types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StepFooter } from './StepFooter';

// Figma "Input": 42px field, input border, 11px semibold value.
export const FIELD_CLS = 'h-[42px] min-h-[42px] rounded-[6px] border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[11px] font-semibold tracking-[-0.242px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading';
const LABEL_CLS = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
const Req = () => <span className="text-error-normal" aria-hidden> *</span>;

export function Step1ProjectSetup({ form, setForm, generatedProjectCode, formattedAddressPreview, onNext, onCancel }: {
  form: FormState;
  setForm: SetForm;
  generatedProjectCode: string;
  formattedAddressPreview: string;
  onNext: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h2 className="m-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Project setup</h2>
        <p className="mt-1 text-[13px] text-ui-body">Set up the basics for this lead to generate a project code and site address.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="intake-company" className={LABEL_CLS}>Company<Req /></label>
          <Select
            id="intake-company" className={FIELD_CLS} placeholder="Select"
            value={form.company || form.service_line}
            onValueChange={v => setForm(f => ({ ...f, company: v ?? '', service_line: v ?? '' }))}
            options={SERVICE_LINES.map(sl => ({ value: sl.value, label: sl.label }))}
          />
        </div>
        <div>
          <label htmlFor="intake-region" className={LABEL_CLS}>Region<Req /></label>
          <Select
            id="intake-region" className={FIELD_CLS} placeholder="Select"
            value={form.region}
            onValueChange={v => setForm(f => ({ ...f, region: v ?? '' }))}
            options={REGIONS.map(r => ({ value: r.code, label: r.label }))}
          />
        </div>
        <div>
          <label htmlFor="intake-project-type" className={LABEL_CLS}>Project type<Req /></label>
          <Select
            id="intake-project-type" className={FIELD_CLS} placeholder="Select"
            value={form.project_type}
            onValueChange={v => setForm(f => ({ ...f, project_type: v ?? '' }))}
            options={PROJECT_TYPES.map(pt => ({ value: pt, label: pt }))}
          />
        </div>
      </div>

      <div>
        <span className={LABEL_CLS}>Project code</span>
        <div className="flex min-h-[42px] items-center rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 font-mono text-[11px] font-semibold tracking-[0.2em] text-[var(--color-secondary-700)] dark:text-ui-heading">
          {form.region ? generatedProjectCode : '_ _ _  _ _ _  _ _ _ _'}
        </div>
        <p className="mt-[7px] text-[12px] font-medium leading-4 text-ui-text-disabled">
          Auto-generated: company + region + running number (e.g. STW 460).
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="m-0 text-[15px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Project site details</h3>
          <p className="m-0 text-[13px] text-ui-body">The job-site address — used to name the project.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="intake-street" className={LABEL_CLS}>Street<Req /></label>
            <Input id="intake-street" className={FIELD_CLS} placeholder="type.." value={form.street}
              onChange={e => setForm(f => ({ ...f, street: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="intake-city" className={LABEL_CLS}>City<Req /></label>
            <Input id="intake-city" className={FIELD_CLS} placeholder="type.." value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="intake-state" className={LABEL_CLS}>State<Req /></label>
            <Select
              id="intake-state" className={FIELD_CLS} placeholder="Select"
              value={form.state}
              onValueChange={v => setForm(f => ({ ...f, state: v ?? '' }))}
              options={US_STATES.map(s => ({ value: s.abbr, label: `${s.name} (${s.abbr})` }))}
            />
          </div>
        </div>
        <div
          aria-label="Project name preview"
          className="flex min-h-[42px] items-center rounded-[6px] border border-[var(--ui-input-border)] bg-ui-surface px-3 text-[11px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading"
        >
          {formattedAddressPreview}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="intake-areas" className={LABEL_CLS}>Target Areas / Rooms</label>
          <Textarea
            id="intake-areas" rows={9} placeholder="Type here.."
            className="min-h-[217px] rounded-[6px] border-[var(--ui-input-border)] bg-ui-input-bg p-3 text-[14px]"
            value={form.notes.areas}
            onChange={e => setForm(f => ({ ...f, notes: { ...f.notes, areas: e.target.value } }))}
          />
        </div>
        <div>
          <label htmlFor="intake-requests" className={LABEL_CLS}>Client Special Requests</label>
          <Textarea
            id="intake-requests" rows={9} placeholder="Type here.."
            className="min-h-[217px] rounded-[6px] border-[var(--ui-input-border)] bg-ui-input-bg p-3 text-[14px]"
            value={form.notes.client_special_request}
            onChange={e => setForm(f => ({ ...f, notes: { ...f.notes, client_special_request: e.target.value } }))}
          />
        </div>
      </div>

      <StepFooter backLabel="Cancel" onBack={onCancel} onNext={onNext} />
    </div>
  );
}
