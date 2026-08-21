'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { US_STATES } from '@/lib/usStates';
import { LocationSearch } from '@/components/platform/projects/LocationSearch';
import { SURVEY_TEMPLATES, SURVEY_TEMPLATE_LABELS, type SurveyTemplate } from '@/lib/marketing/surveyTemplates';

function TextField({ label, required, hint, value, ...props }: { label: string; required?: boolean; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`form-label${required ? ' required' : ''}`} style={{ fontSize: 12 }}>{label}</label>
      <input id={id} className="form-input" autoComplete="off" value={value ?? ''} {...props} />
      {hint && <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
function TextAreaField({ label, hint, value, ...props }: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="form-label" style={{ fontSize: 12 }}>{label}</label>
      <textarea id={id} className="form-input" autoComplete="off" style={{ resize: 'vertical' }} rows={3} value={value ?? ''} {...props} />
      {hint && <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export interface CampaignFormValues {
  name: string;
  state: string;
  city: string;
  startDate: string;
  endDate: string;
  description: string;
  surveyTemplate: SurveyTemplate;
}

export const EMPTY_CAMPAIGN_FORM: CampaignFormValues = {
  name: '', state: '', city: '', startDate: '', endDate: '', description: '', surveyTemplate: 'none',
};

interface Props {
  mode: 'create' | 'edit';
  campaignId?: string;
  initial: CampaignFormValues;
}

export function CampaignFormClient({ mode, campaignId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignFormValues>(initial);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CampaignFormValues>(key: K, value: CampaignFormValues[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.name.trim()) { toast.error('Campaign name is required'); return; }

    setSaving(true);
    try {
      const url = mode === 'create' ? '/api/marketing/campaigns' : `/api/marketing/campaigns/${campaignId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          campaignType: 'trade_fair', source: 'trade_fair', defaultLanguage: 'en',
          state: form.state || undefined,
          city: form.city.trim() || undefined,
          country: (form.state || form.city.trim()) ? 'US' : undefined,
          description: form.description.trim() || undefined,
          startDate: form.startDate || undefined, endDate: form.endDate || undefined,
          surveyTemplate: form.surveyTemplate,
        }),
      });
      if (res.redirected && res.url.includes('/login')) {
        toast.error('Your session has expired — please log in again.');
        router.push('/login');
        setSaving(false);
        return;
      }

      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        toast.error(body?.error ?? 'Could not save campaign — please try again.');
        setSaving(false);
        return;
      }
      if (!body.campaign?.id) {
        toast.error('Campaign save did not return the expected result — please refresh and check whether it was created.');
        setSaving(false);
        return;
      }

      toast.success(mode === 'create' ? 'Campaign created' : 'Campaign updated');
      router.push(`/marketing/campaigns/${body.campaign.id}`);
      router.refresh();
    } catch (e) {
      console.error('[CampaignFormClient] submit failed:', e);
      toast.error(e instanceof Error ? `Could not save campaign: ${e.message}` : 'Could not save campaign — check the browser console for details.');
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>
        {mode === 'create' ? 'New Campaign' : 'Edit Campaign'}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
        {mode === 'create'
          ? 'The public survey link and QR code are generated automatically once this is created.'
          : 'The public survey link never changes, even if you rename this campaign.'}
      </p>

      <div className="card"><div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextField label="Campaign name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Atlanta Build Expo 2026" />

        <div>
          <label className="form-label" style={{ fontSize: 12 }}>Location (US)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <select
              className="form-input" autoComplete="off"
              style={{ width: 150, flexShrink: 0 }}
              value={form.state}
              onChange={e => set('state', e.target.value)}
            >
              <option value="">State…</option>
              {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
            </select>
            <div style={{ flex: 1, minWidth: 0 }}>
              <LocationSearch
                stateAbbr={form.state}
                placeholder="City — e.g. Atlanta"
                onSelect={r => set('city', r.city || r.label)}
              />
            </div>
          </div>
          {form.city && <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 4 }}>Selected: {form.city}{form.state ? `, ${form.state}` : ''}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextField label="Start date" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          <TextField label="End date" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
        </div>

        <div>
          <label className="form-label" style={{ fontSize: 12 }}>Survey page template</label>
          <select
            className="form-input" autoComplete="off"
            value={form.surveyTemplate}
            onChange={e => set('surveyTemplate', e.target.value as SurveyTemplate)}
          >
            {SURVEY_TEMPLATES.map(t => <option key={t} value={t}>{SURVEY_TEMPLATE_LABELS[t]}</option>)}
          </select>
          <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 2 }}>
            Which design the public link/QR code opens at /survey/{'{link}'}. You can change this later from Edit.
          </div>
        </div>

        <TextAreaField
          label="Internal description" value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="A reminder note about this campaign — not shown publicly"
          hint="Internal only — for the Marketing team, never shown on the public survey page."
        />
      </div></div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create Campaign' : 'Save Changes'}
        </button>
        <button className="btn btn-ghost" disabled={saving} onClick={() => router.back()}>Cancel</button>
      </div>
    </div>
  );
}
