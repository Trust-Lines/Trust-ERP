'use client';

import { StepFooter } from './StepFooter';
import type { StepProps } from './types';
import { Input } from '@/components/ui/input';

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
          <Input
            type="text"
            placeholder="e.g. Acme Retail LLC"
            value={form.customer_name}
            onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
          <Input
            type="text"
            placeholder="e.g. Brand / Franchise name"
            value={form.brand}
            onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Contact person</label>
          <Input
            type="text"
            placeholder="Full name"
            value={form.contact_person}
            onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Contact email</label>
          <Input
            type="email"
            placeholder="email@domain.com"
            value={form.customer_email}
            onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
          />
        </div>
      </div>

      <StepFooter nextLabel="Continue to Lead details" onBack={onBack} onNext={onNext} />
    </div>
  );
}
