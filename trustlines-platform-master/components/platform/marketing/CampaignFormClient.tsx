'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { US_STATES } from '@/lib/usStates';
import { LocationSearch } from '@/components/platform/projects/LocationSearch';
import { SURVEY_TEMPLATES, SURVEY_TEMPLATE_LABELS, type SurveyTemplate } from '@/lib/marketing/surveyTemplates';
import { Select } from '@/components/platform/shared/Select';
import { feedback } from '@/components/ui/feedback-toast';
// Shared wizard look (cards, labels, inputs, preview panel) with the New Project / Capture Contact forms.
import { NEW_PROJECT_STYLES } from '@/components/platform/projects/new-project/styles';

function TextField({ label, required, hint, value, ...props }: { label: string; required?: boolean; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`form-label${required ? ' required' : ''}`}>{label}</label>
      <input id={id} className="form-input" autoComplete="off" value={value ?? ''} {...props} />
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}
function TextAreaField({ label, hint, value, ...props }: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <textarea id={id} className="form-input" autoComplete="off" style={{ resize: 'vertical', minHeight: 90 }} rows={4} value={value ?? ''} {...props} />
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}

// The backend has always supported 'event' as a campaign_type alongside 'trade_fair'
// (CAMPAIGN_TYPES in lib/marketing/campaigns.ts, DB CHECK constraint) — this form just never
// exposed it, hardcoding campaignType/source to 'trade_fair' on every create. That's the actual
// gap behind "no Events module": there never needed to be a second table, only this selector.
export type CampaignKind = 'trade_fair' | 'event';
export const CAMPAIGN_KIND_LABEL: Record<CampaignKind, string> = {
  trade_fair: 'Trade Fair', event: 'Event',
};

export interface CampaignFormValues {
  name: string;
  campaignType: CampaignKind;
  state: string;
  city: string;
  startDate: string;
  endDate: string;
  description: string;
  surveyTemplate: SurveyTemplate;
}

export const EMPTY_CAMPAIGN_FORM: CampaignFormValues = {
  name: '', campaignType: 'trade_fair', state: '', city: '', startDate: '', endDate: '', description: '', surveyTemplate: 'general',
};

type CampaignStatus = 'draft' | 'active' | 'paused' | 'closed';
const STATUS_BADGE: Record<CampaignStatus, { label: string; bg: string }> = {
  draft: { label: 'DRAFT', bg: 'var(--color-grey-500)' },
  active: { label: 'ACTIVE', bg: 'var(--color-success-normal)' },
  paused: { label: 'PAUSED', bg: 'var(--color-warning-normal)' },
  closed: { label: 'CLOSED', bg: 'var(--color-error-normal)' },
};

const DATE_ONLY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
function displayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : DATE_ONLY.format(d);
}

interface Props {
  mode: 'create' | 'edit';
  campaignId?: string;
  /** Current status in edit mode — drives the preview badge and the Make Inactive / Active button. */
  status?: CampaignStatus;
  initial: CampaignFormValues;
}

export function CampaignFormClient({ mode, campaignId, status, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

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
          campaignType: form.campaignType, source: form.campaignType, defaultLanguage: 'en',
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

      feedback.success(mode === 'create' ? 'Campaign created' : 'Changes saved', {
        description: mode === 'create' ? undefined : 'The campaign is up to date.',
      });
      router.push(`/marketing/campaigns/${body.campaign.id}`);
      router.refresh();
    } catch (e) {
      console.error('[CampaignFormClient] submit failed:', e);
      toast.error(e instanceof Error ? `Could not save campaign: ${e.message}` : 'Could not save campaign — check the browser console for details.');
      setSaving(false);
    }
  }

  // Edit mode only — same endpoints the campaign detail page and list already use.
  async function runAction(action: 'pause' | 'activate' | 'trash', confirmMessage: string) {
    if (!campaignId || !window.confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}/${action}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not update campaign'); return; }
      if (action === 'trash') {
        feedback.info('Campaign moved to Trash', { description: form.name || undefined });
        router.push('/marketing/campaigns');
      } else {
        toast.success(action === 'pause' ? 'Campaign made inactive' : 'Campaign activated');
      }
      router.refresh();
    } catch {
      toast.error('Could not update campaign');
    } finally {
      setBusy(false);
    }
  }

  const badge = STATUS_BADGE[status ?? 'draft'];
  const cityState = [form.city.trim(), form.state].filter(Boolean).join(', ');
  const previewRows: { key: string; value: string }[] = [
    { key: 'Name', value: form.name.trim() },
    { key: 'Type', value: CAMPAIGN_KIND_LABEL[form.campaignType] },
    { key: 'City/State', value: cityState },
    { key: 'Start Date', value: displayDate(form.startDate) },
    { key: 'End Date', value: displayDate(form.endDate) },
  ];

  return (
    <div className="new-project-wrapper">
      <style>{NEW_PROJECT_STYLES}</style>

      <div className="np-top-header">
        <div className="np-top-header-left">
          <h1 className="np-title">{mode === 'create' ? 'New Campaign' : 'Edit Campaign'}</h1>
          <p className="np-subtitle">
            {mode === 'create'
              ? 'The public survey link and QR code are generated automatically once this is created.'
              : 'The public survey link never changes, even if you rename this campaign.'}
          </p>
        </div>
        {mode === 'edit' && campaignId && (
          <div className="flex flex-wrap items-center gap-4">
            {status === 'paused' || status === 'draft' ? (
              <button
                type="button" className="np-cancel-btn" disabled={busy}
                style={{ background: 'var(--status-t6-bg)', borderColor: 'var(--status-t6-bg)', color: 'var(--status-t6-fg)' }}
                onClick={() => runAction('activate', 'Make this campaign active? The survey link will accept responses again.')}
              >
                <ToggleRight size={16} aria-hidden /> Make Active
              </button>
            ) : (
              <button
                type="button" className="np-cancel-btn" disabled={busy}
                style={{ background: 'var(--status-t7-bg)', borderColor: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}
                onClick={() => runAction('pause', 'Make this campaign inactive? The survey link stops accepting responses until it is made active again.')}
              >
                <ToggleLeft size={16} aria-hidden /> Make Inactive
              </button>
            )}
            <button
              type="button" className="np-cancel-btn" disabled={busy}
              onClick={() => runAction('trash', `Move "${form.name || 'this campaign'}" to Trash? It can be restored from Trash.`)}
            >
              <Trash2 size={16} aria-hidden /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="np-main-grid">
        <div className="np-card step-content-card" style={{ minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-grid-2" style={{ marginBottom: 0 }}>
              <TextField label="Campaign Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Type.." />
              <div>
                <label className="form-label">Survey Page Template</label>
                <Select
                  className="form-input" autoComplete="off" aria-label="Survey page template"
                  value={form.surveyTemplate}
                  onChange={e => set('surveyTemplate', e.target.value as SurveyTemplate)}
                >
                  {SURVEY_TEMPLATES.map(t => <option key={t} value={t}>{SURVEY_TEMPLATE_LABELS[t]}</option>)}
                </Select>
              </div>

              <div>
                <label className="form-label">Type</label>
                <Select
                  className="form-input" aria-label="Campaign type"
                  value={form.campaignType}
                  onChange={e => set('campaignType', e.target.value as CampaignKind)}
                >
                  {(['trade_fair', 'event'] as const).map(kind => <option key={kind} value={kind}>{CAMPAIGN_KIND_LABEL[kind]}</option>)}
                </Select>
                <div className="form-hint">Trade Fair — a booth at a show. Event — a standalone meeting/conference/other gathering.</div>
              </div>
              <div>
                <label className="form-label">Location (US)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <Select
                    className="form-input" autoComplete="off" aria-label="State"
                    style={{ width: 110, flexShrink: 0 }}
                    value={form.state}
                    onChange={e => set('state', e.target.value)}
                  >
                    <option value="">State</option>
                    {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
                  </Select>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <LocationSearch
                      stateAbbr={form.state}
                      placeholder="Select or Type.."
                      onSelect={r => set('city', r.city || r.label)}
                    />
                  </div>
                </div>
                {form.city && <div className="form-hint">Selected: {cityState}</div>}
              </div>

              <TextField label="Start Date" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
              <TextField label="End Date" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>

            <TextAreaField
              label="Internal Description (Not Shown Publicly)" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Type here.."
            />
          </div>

          <div className="step-footer-actions">
            <button type="button" className="btn-outline-custom muted" disabled={saving} onClick={() => router.back()}>
              Cancel
            </button>
            <div className="step-footer-right">
              <button type="button" className="btn-primary-navy" disabled={saving} onClick={submit}>
                {saving ? 'Saving…' : mode === 'create' ? 'Create Campaign' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        <aside className="summary-sidebar-card" aria-label="Campaign preview">
          <div className="summary-head">
            <h3 className="np-card-title">Campaign Preview</h3>
            <span
              className="np-status-badge"
              style={{ background: badge.bg, color: '#fff', padding: '2px 10px', fontSize: 11 }}
            >
              {badge.label}
            </span>
          </div>
          {previewRows.map(r => (
            <div key={r.key} className="summary-row">
              <span className="summary-row-key">{r.key}</span>
              <span className="summary-row-val">{r.value || '-'}</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
