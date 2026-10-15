'use client';

import { FieldError, FieldLabel } from './helpers';
import type { FormHandles } from './formTypes';

export function Step3Timeline({ form, aiFields }: { form: FormHandles; aiFields: Set<string> }) {
  const { register, errors } = form;

  return (
    <div className="form-grid-2">
      <div className="form-group">
        <FieldLabel required aiField={aiFields.has('closed_deal_date')}>Closed-deal date</FieldLabel>
        <input className="form-input" type="date" {...register('closed_deal_date')} />
      </div>
      <div className="form-group">
        <FieldLabel required>Estimated delivery date</FieldLabel>
        <input className="form-input" type="date" {...register('est_delivery_date')} />
        <FieldError msg={errors.est_delivery_date?.message} />
      </div>
    </div>
  );
}
