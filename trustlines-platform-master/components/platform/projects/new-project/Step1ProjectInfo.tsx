'use client';

import { US_STATES } from '@/lib/usStates';
import { Select } from '@/components/platform/shared/Select';
import { LocationSearch, type GeoResult } from '../LocationSearch';
import { FieldError, FieldLabel, type ClientRow, type CompanyRow } from './helpers';
import type { FormHandles } from './formTypes';

export function Step1ProjectInfo({
  form, isEdit, aiFields, autoCodeMode, watchedCode, watchedServiceId,
  localClients, companies, selectedClientId, onRegionChange, onLocationSelect,
  searchState, setSearchState,
  showNewClientForm, setShowNewClientForm,
  newClientName, setNewClientName, newClientCode, setNewClientCode, savingClient, onSaveClient,
}: {
  form: FormHandles;
  isEdit: boolean;
  aiFields: Set<string>;
  autoCodeMode: boolean;
  watchedCode: string | undefined;
  watchedServiceId: string | undefined;
  localClients: ClientRow[];
  companies: CompanyRow[];
  selectedClientId: string;
  onRegionChange: (clientId: string) => void;
  onLocationSelect: (r: GeoResult) => void;
  searchState: string;
  setSearchState: (state: string) => void;
  showNewClientForm: boolean;
  setShowNewClientForm: (show: boolean) => void;
  newClientName: string;
  setNewClientName: (name: string) => void;
  newClientCode: string;
  setNewClientCode: (code: string) => void;
  savingClient: boolean;
  onSaveClient: () => void;
}) {
  const { register, setValue, errors } = form;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-grid-2">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <FieldLabel required>Region</FieldLabel>
            {!isEdit && (
              <button
                type="button"
                onClick={() => setShowNewClientForm(true)}
                style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                + Add new region
              </button>
            )}
          </div>
          <Select
            className="form-input form-select"
            value={selectedClientId}
            disabled={isEdit}
            onChange={e => {
              const val = e.target.value;
              if (val === '__new__') { setShowNewClientForm(true); return; }
              onRegionChange(val);
            }}
          >
            <option value="">Select region...</option>
            {localClients.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
            ))}
          </Select>
          <FieldError msg={errors.client_id?.message} />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <FieldLabel required>Company</FieldLabel>
          <Select
            className="form-input form-select"
            value={watchedServiceId ?? ''}
            onChange={e => {
              setValue('client_franchise_id', undefined);
              setValue('client_company_id', e.target.value || undefined, { shouldValidate: true });
            }}
          >
            <option value="">Select company...</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
            ))}
          </Select>
          <span className="form-hint">Choose a Store Maker, Premium, or Design company.</span>
          <FieldError msg={errors.client_company_id?.message} />
        </div>
      </div>

      {showNewClientForm && (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14, marginBottom: 8 }}>
          <div className="form-grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label className="form-label required">Region name</label>
              <input className="form-input" placeholder="e.g. T-Lines North East" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Code</label>
              <input className="form-input" placeholder="e.g. NE" value={newClientCode} onChange={e => setNewClientCode(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={onSaveClient} disabled={!newClientName.trim() || savingClient}>
              {savingClient ? 'Saving...' : 'Save region'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewClientForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Project Number Field */}
      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <FieldLabel required aiField={aiFields.has('project_code')}>Project number</FieldLabel>
          <span className="auto-badge">⚡ Auto</span>
        </div>
        <input
          className="form-input"
          readOnly={autoCodeMode}
          value={watchedCode ?? ''}
          placeholder="-- -- --"
          style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em', maxWidth: 260, background: autoCodeMode ? 'var(--bg-subtle)' : 'var(--bg-surface)' }}
          {...register('project_code')}
        />
        <span className="form-hint">Pick a Region and Company to generate automatically, or leave empty to type manually.</span>
        <FieldError msg={errors.project_code?.message} />
      </div>

      {/* Find Location (US) Section */}
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-default)', marginBottom: 12 }}>Find location (US)</h3>
        <div className="form-grid-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <FieldLabel required>State</FieldLabel>
            <Select
              className="form-input form-select"
              value={searchState}
              onChange={e => setSearchState(e.target.value)}
            >
              <option value="">Select state...</option>
              {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
            </Select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <FieldLabel required>City or full street address</FieldLabel>
            <LocationSearch
              stateAbbr={searchState}
              placeholder="Search city or enter full street address"
              onSelect={onLocationSelect}
            />
          </div>
        </div>
        <span className="form-hint" style={{ marginTop: 6, display: 'block' }}>
          Pick the state, then type a city or full street address to get the exact address with ZIP. This will auto-fill the Project name and Site / location.
        </span>
      </div>

      <div className="form-grid-3" style={{ marginTop: 8 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <FieldLabel required aiField={aiFields.has('name')}>Project name</FieldLabel>
          <input className="form-input" placeholder="Auto-filled from location" {...register('name')} />
          <FieldError msg={errors.name?.message} />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <FieldLabel required aiField={aiFields.has('closed_deal_date')}>Closed-deal date</FieldLabel>
          <input className="form-input" type="date" {...register('closed_deal_date')} />
          <FieldError msg={errors.closed_deal_date?.message} />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <FieldLabel required aiField={aiFields.has('site_location')}>Site / location</FieldLabel>
          <input className="form-input" placeholder="Auto-filled from address" {...register('site_location')} />
          <FieldError msg={errors.site_location?.message} />
        </div>
      </div>
    </div>
  );
}
