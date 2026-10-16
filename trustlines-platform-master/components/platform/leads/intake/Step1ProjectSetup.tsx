'use client';

import { ChevronDown, ArrowRight } from 'lucide-react';
import { US_STATES } from '@/lib/usStates';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { PROJECT_TYPES } from '@/lib/sales/projectTypes';
import { Select } from '@/components/platform/shared/Select';
import type { FormState, SetForm } from './types';

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
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Company <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Select
              value={form.company || form.service_line}
              onChange={e => setForm(f => ({ ...f, company: e.target.value, service_line: e.target.value }))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select company...</option>
              {SERVICE_LINES.map(sl => (
                <option key={sl.value} value={sl.value}>{sl.label}</option>
              ))}
            </Select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Region <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Select
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select region...</option>
              {REGIONS.map(r => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </Select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Project type <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Select
              value={form.project_type}
              onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select project type...</option>
              {PROJECT_TYPES.map(pt => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </Select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
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
          <input
            type="text"
            placeholder="Enter street address"
            value={form.street}
            onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              City <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter city"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              State <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Select
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">Select state...</option>
                {US_STATES.map(s => (
                  <option key={s.abbr} value={s.abbr}>{s.name} ({s.abbr})</option>
                ))}
              </Select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-center gap-2">
          <span className="text-blue-600 font-bold">ⓘ</span>
          <span>{formattedAddressPreview}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <span>Continue to Customer</span>
          <ArrowRight size={14} />
        </button>
        <button
          type="button"
          onClick={onSaveAndExit}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
}
