'use client';

import { StepFooter } from './StepFooter';
import { FIELD_CLS } from './Step1ProjectSetup';
import type { StepProps } from './types';
import { Input } from '@/components/ui/input';

const LABEL_CLS = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';

// Figma "New lead · Customer" (node 290:37033): two rows of two 42px fields.
export function Step2Customer({ form, setForm, onBack, onNext, onSaveDraft }: StepProps) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h2 className="m-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Customer information</h2>
        <p className="mt-1 text-[13px] text-ui-body">Enter the customer or client brand details.</p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
        <div>
          <label htmlFor="intake-customer-name" className={LABEL_CLS}>
            Customer name<span className="text-error-normal" aria-hidden>*</span>
          </label>
          <Input
            id="intake-customer-name" type="text" required className={FIELD_CLS} placeholder="type.."
            value={form.customer_name}
            onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="intake-brand" className={LABEL_CLS}>Brand</label>
          <Input
            id="intake-brand" type="text" className={FIELD_CLS} placeholder="type.."
            value={form.brand}
            onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="intake-contact-person" className={LABEL_CLS}>Contact person</label>
          <Input
            id="intake-contact-person" type="text" className={FIELD_CLS} placeholder="type.."
            value={form.contact_person}
            onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="intake-contact-email" className={LABEL_CLS}>Contact email</label>
          <Input
            id="intake-contact-email" type="email" className={FIELD_CLS} placeholder="type.."
            value={form.customer_email}
            onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
          />
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} onSaveDraft={onSaveDraft} />
    </div>
  );
}
