'use client';

import { FieldLabel } from './helpers';
import type { FormHandles } from './formTypes';

export function Step5Integrations({ form }: { form: FormHandles }) {
  const { register } = form;

  return (
    <div className="form-grid-2">
      <div className="form-group">
        <FieldLabel>ClickUp Task ID</FieldLabel>
        <input className="form-input" placeholder="Paste ClickUp task ID" {...register('clickup_task_id')} />
      </div>
      <div className="form-group">
        <FieldLabel>QuickBooks Reference</FieldLabel>
        <input className="form-input" placeholder="QuickBooks reference" {...register('quickbooks_ref')} />
      </div>
    </div>
  );
}
