'use client';

import { StepFooter } from './StepFooter';
import type { StepProps } from './types';

export function Step2Customer({ form, setForm, onBack, onNext }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Customer information</h2>
        <p className="text-xs text-slate-500 mt-0.5">Enter the customer or client brand details.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Customer name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Acme Retail LLC"
            value={form.customer_name}
            onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
          <input
            type="text"
            placeholder="e.g. Brand / Franchise name"
            value={form.brand}
            onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Contact person</label>
          <input
            type="text"
            placeholder="Full name"
            value={form.contact_person}
            onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Contact email</label>
          <input
            type="email"
            placeholder="email@domain.com"
            value={form.customer_email}
            onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      <StepFooter nextLabel="Continue to Lead details" onBack={onBack} onNext={onNext} />
    </div>
  );
}
