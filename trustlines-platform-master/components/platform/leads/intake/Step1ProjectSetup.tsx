'use client';

import { ArrowRight } from 'lucide-react';
import { US_STATES } from '@/lib/usStates';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { PROJECT_TYPES } from '@/lib/sales/projectTypes';
import type { FormState, SetForm } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function Step1ProjectSetup({ form, setForm, generatedProjectCode, formattedAddressPreview, onNext, onSaveAndExit }: {
  form: FormState;
  setForm: SetForm;
  generatedProjectCode: string;
  formattedAddressPreview: string;
  onNext: () => void;
  onSaveAndExit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Project setup</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Set up the basics for this lead to generate a project code and site address.
        </p>
      </div>

      {/* 3-column row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div>
          <label htmlFor="intake-company" className="block text-xs font-semibold text-slate-700 mb-1">
            Company <span className="text-rose-500">*</span>
          </label>
          <Select
            id="intake-company"
            placeholder="Select company..."
            value={form.company || form.service_line}
            onValueChange={v => setForm(f => ({ ...f, company: v ?? '', service_line: v ?? '' }))}
            options={SERVICE_LINES.map(sl => ({ value: sl.value, label: sl.label }))}
          />
        </div>

        <div>
          <label htmlFor="intake-region" className="block text-xs font-semibold text-slate-700 mb-1">
            Region <span className="text-rose-500">*</span>
          </label>
          <Select
            id="intake-region"
            placeholder="Select region..."
            value={form.region}
            onValueChange={v => setForm(f => ({ ...f, region: v ?? '' }))}
            options={REGIONS.map(r => ({ value: r.code, label: r.label }))}
          />
        </div>

        <div>
          <label htmlFor="intake-project-type" className="block text-xs font-semibold text-slate-700 mb-1">
            Project type <span className="text-rose-500">*</span>
          </label>
          <Select
            id="intake-project-type"
            placeholder="Select project type..."
            value={form.project_type}
            onValueChange={v => setForm(f => ({ ...f, project_type: v ?? '' }))}
            options={PROJECT_TYPES.map(pt => ({ value: pt, label: pt }))}
          />
        </div>
      </div>

      {/* Project code */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Project code</label>
        <div className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono">
          {form.region ? generatedProjectCode : '-- -- --'}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Auto-generated: company + region + running number (e.g. STW 460).
        </p>
      </div>

      {/* Project site address */}
      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-xs font-bold text-slate-900">Project site address</h3>
          <p className="text-[11px] text-slate-500">The job-site address — used to name the project.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Street <span className="text-rose-500">*</span>
          </label>
          <Input
            type="text"
            placeholder="Enter street address"
            value={form.street}
            onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              City <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="Enter city"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="intake-state" className="block text-xs font-semibold text-slate-700 mb-1">
              State <span className="text-rose-500">*</span>
            </label>
            <Select
              id="intake-state"
              placeholder="Select state..."
              value={form.state}
              onValueChange={v => setForm(f => ({ ...f, state: v ?? '' }))}
              options={US_STATES.map(s => ({ value: s.abbr, label: `${s.name} (${s.abbr})` }))}
            />
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-center gap-2">
          <span className="text-blue-600 font-bold">ⓘ</span>
          <span>{formattedAddressPreview}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
        <Button
          type="button"
          onClick={onNext}
        >
          <span>Continue to Customer</span>
          <ArrowRight size={14} />
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={onSaveAndExit}
        >
          Save and exit
        </Button>
      </div>
    </div>
  );
}
