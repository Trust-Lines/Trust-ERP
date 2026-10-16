'use client';

import { FieldLabel } from './helpers';
import type { FormHandles } from './formTypes';

export function Step4DropboxFolder({ form, watchedCode, watchedSiteLocation }: {
  form: FormHandles;
  watchedCode: string | undefined;
  watchedSiteLocation: string | undefined;
}) {
  const { register, watch } = form;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group">
        <FieldLabel>Client Name (Optional)</FieldLabel>
        <input
          className="form-input"
          placeholder="e.g. SPEEDY — leave empty for Individual project"
          {...register('dropbox_client_name')}
        />
      </div>
      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: '#475569' }}>
        /D-Projects/T LINES/{watch('dropbox_section') || '1-Store Maker'}/{watch('dropbox_region') || 'T Lines NE Projects'}/Under Working/
        {watch('dropbox_client_type') === 'Clients' ? 'Clients' : 'Individiuals'}
        {watch('dropbox_client_type') === 'Clients' && watch('dropbox_client_name') ? `/${watch('dropbox_client_name')}` : ''}
        /{watchedCode || '{number}'} - {watchedSiteLocation || '{location}'}
      </div>
    </div>
  );
}
