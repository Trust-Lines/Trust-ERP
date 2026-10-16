'use client';

import { Select } from '@/components/platform/shared/Select';
import { FieldError, FieldLabel, type PmProfileRow, type ProfileRow } from './helpers';
import type { FormHandles } from './formTypes';

export function Step6InitialTeam({ form, trustlinesPmProfiles, tlinesPmProfiles }: {
  form: FormHandles;
  trustlinesPmProfiles: ProfileRow[];
  tlinesPmProfiles: PmProfileRow[];
}) {
  const { register, errors } = form;

  return (
    <div className="form-grid-2">
      <div className="form-group">
        <FieldLabel required>Trust-Lines PM</FieldLabel>
        <Select className="form-input form-select" {...register('trustlines_pm_id')}>
          <option value="">Select Trust-Lines PM...</option>
          {trustlinesPmProfiles.map(p => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </Select>
        <FieldError msg={errors.trustlines_pm_id?.message} />
      </div>

      <div className="form-group">
        <FieldLabel required>Client PM (T-Lines)</FieldLabel>
        <Select className="form-input form-select" {...register('tlines_pm_id')}>
          <option value="">Select T-Lines PM...</option>
          {tlinesPmProfiles.map(p => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </Select>
        <FieldError msg={errors.tlines_pm_id?.message} />
      </div>
    </div>
  );
}
