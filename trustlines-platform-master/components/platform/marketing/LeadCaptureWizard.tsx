'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, FolderOpen, Info, Paperclip, Upload, X } from 'lucide-react';
import {
  ENTITY_TYPES, ENTITY_TYPE_LABEL, PROJECT_TYPES, PROJECT_TYPE_LABEL,
  SCOPE_TYPES, SCOPE_TYPE_LABEL, TIMINGS, TIMING_LABEL, LEAD_CLASSIFICATION_LABEL,
  classifyLead, type ClassificationResult,
} from '@/lib/marketing/classification';
import { classifySourceValue } from '@/lib/clickup/importMapping';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { hashColor } from '@/lib/marketing/pillColor';
import { SourceSelect } from './SourceSelect';
import { TagMultiSelect } from './TagMultiSelect';
import type { LeadEntityType, ProjectType, ScopeType, LeadTiming } from '@/types/database';
import { Select } from '@/components/platform/shared/Select';
import { feedback } from '@/components/ui/feedback-toast';
// Shared wizard look (progress row, cards, chips, summary panel) with the New Project wizard.
import { NEW_PROJECT_STYLES } from '@/components/platform/projects/new-project/styles';

const STEPS = ['Source', 'Company', 'Contact', 'Project Need', 'Classification'] as const;
const CONTACT_METHODS = ['Email', 'Phone', 'WhatsApp', 'Other'];

interface FormState {
  entityType: LeadEntityType | '';
  sourceRaw: string;
  tags: string[];
  organizationName: string;
  brandName: string;
  industry: string;
  website: string;
  locationCount: string;
  multipleAddresses: boolean;
  existingLocations: boolean;
  futureExpansion: boolean;
  personName: string;
  personOccupation: string;
  personEmail: string;
  personPhone: string;
  country: string;
  city: string;
  state: string;
  region: string;
  serviceLine: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  isDecisionMaker: boolean;
  preferredContactMethod: string;
  projectTypes: ProjectType[];
  scopeTypes: ScopeType[];
  hasActiveProject: boolean | null;
  deadline: string;
  expectedStartDate: string;
  layoutAvailable: boolean | null;
  siteReady: boolean | null;
  budgetRange: string;
  notes: string;
  timing: LeadTiming | '';
  targetContactDate: string;
}

const INITIAL: FormState = {
  entityType: '', sourceRaw: '', tags: [],
  organizationName: '', brandName: '', industry: '', website: '', locationCount: '',
  multipleAddresses: false, existingLocations: false, futureExpansion: false,
  personName: '', personOccupation: '', personEmail: '', personPhone: '',
  country: '', city: '', state: '', region: '', serviceLine: '',
  contactName: '', contactTitle: '', contactEmail: '', contactPhone: '', isDecisionMaker: false, preferredContactMethod: '',
  projectTypes: [], scopeTypes: [], hasActiveProject: null, deadline: '', expectedStartDate: '',
  layoutAvailable: null, siteReady: null, budgetRange: '', notes: '', timing: '', targetContactDate: '',
};

function TextField({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`form-label${required ? ' required' : ''}`} style={{ fontSize: 12 }}>{label}</label>
      <input id={id} className="form-input" {...props} />
    </div>
  );
}
function SelectField({ label, required, options, ...props }: { label: string; required?: boolean; options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`form-label${required ? ' required' : ''}`} style={{ fontSize: 12 }}>{label}</label>
      <Select id={id} className="form-input" {...props}>
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  );
}
function TextAreaField({ label, required, ...props }: { label: string; required?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`form-label${required ? ' required' : ''}`} style={{ fontSize: 12 }}>{label}</label>
      <textarea id={id} className="form-input" style={{ resize: 'vertical' }} {...props} />
    </div>
  );
}
const DIAL_CODES = ['+1', '+90', '+966', '+971', '+44', '+49'];

/** Dial-code prefix + number (Figma "Phone Number"); stored as one string, e.g. "+1 555 123 4567". */
function PhoneField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const match = value.match(/^(\+\d{1,4})\s*(.*)$/);
  const code = match && DIAL_CODES.includes(match[1]) ? match[1] : '+1';
  const number = match && DIAL_CODES.includes(match[1]) ? match[2] : value;
  const compose = (c: string, n: string) => onChange(n.trim() ? `${c} ${n}` : '');
  return (
    <div>
      <label htmlFor={id} className="form-label" style={{ fontSize: 12 }}>{label}</label>
      <div className="np-phone">
        <Select
          aria-label={`${label} country code`}
          className="np-phone-code"
          value={code}
          onChange={e => compose(e.target.value, number)}
        >
          {DIAL_CODES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <input
          id={id}
          type="tel"
          className="np-phone-number"
          placeholder="___ ___ ____"
          value={number}
          onChange={e => compose(code, e.target.value)}
        />
      </div>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  );
}

// Same chip as the New Project wizard's category buttons (Figma "Capture New Contact").
function Chip({ active, onClick, children, wide }: { active: boolean; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active}
      className={`np-cat-chip${active ? ' selected' : ''}`}
      style={wide ? { minWidth: 172 } : undefined}
    >
      {active && <Check size={16} aria-hidden />} {children}
    </button>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ fontSize: 13 }} id={`toggle-${label}`}>{label}</span>
      <div role="group" aria-labelledby={`toggle-${label}`} style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn-sm" aria-pressed={value === true} onClick={() => onChange(true)}
          style={{
            background: value === true ? 'var(--status-success-bg)' : 'var(--bg-subtle)',
            color: value === true ? 'var(--status-success-fg)' : 'var(--fg-subtle)',
            border: value === true ? '1px solid var(--status-success-fg)' : '1px solid transparent',
            fontWeight: value === true ? 700 : 400,
          }}>Yes</button>
        <button type="button" className="btn btn-sm" aria-pressed={value === false} onClick={() => onChange(false)}
          style={{
            background: value === false ? 'var(--status-danger-bg)' : 'var(--bg-subtle)',
            color: value === false ? 'var(--status-danger-fg)' : 'var(--fg-subtle)',
            border: value === false ? '1px solid var(--status-danger-fg)' : '1px solid transparent',
            fontWeight: value === false ? 700 : 400,
          }}>No</button>
      </div>
    </div>
  );
}

export function LeadCaptureWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [matterportUrl, setMatterportUrl] = useState('');
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/marketing/prospects/source-options').then(r => r.json()).then(b => setSourceOptions(b.options ?? [])).catch(() => {});
    fetch('/api/marketing/prospects/tag-options').then(r => r.json()).then(b => setTagOptions(b.options ?? [])).catch(() => {});
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(prev => ({ ...prev, [k]: v }));

  const suggestion: ClassificationResult = useMemo(() => classifyLead({
    hasActiveProject: f.hasActiveProject,
    deadline: f.deadline || null,
    expectedStartDate: f.expectedStartDate || null,
    projectTypes: f.projectTypes,
    locationCount: f.locationCount ? Number(f.locationCount) : null,
    futureExpansion: f.futureExpansion,
    layoutAvailable: f.layoutAvailable,
    timing: f.timing || null,
    hasDocumentEvidence: !!layoutFile || !!matterportUrl.trim(),
  }), [f.hasActiveProject, f.deadline, f.expectedStartDate, f.projectTypes, f.locationCount, f.futureExpansion, f.layoutAvailable, f.timing, layoutFile, matterportUrl]);

  const isPerson = f.entityType === 'person';

  const canProceed = (() => {
    switch (step) {
      case 0: return !!f.entityType && !!f.sourceRaw.trim();
      case 1: return isPerson ? !!f.personName.trim() : !!f.organizationName.trim();
      case 3: return !!f.region;
      case 4: return !!f.timing && (f.timing !== 'contact_later' || !!f.targetContactDate);
      default: return true;
    }
  })();

  async function submit() {
    setSaving(true);
    const primaryContact = isPerson
      ? { name: f.personName.trim(), title: f.personOccupation.trim(), email: f.personEmail.trim(), phone: f.personPhone.trim(), is_decision_maker: true }
      : (f.contactName.trim() ? {
          name: f.contactName.trim(), title: f.contactTitle.trim(), email: f.contactEmail.trim(),
          phone: f.contactPhone.trim(), is_decision_maker: f.isDecisionMaker,
          preferred_contact_method: f.preferredContactMethod,
        } : undefined);
    const additionalContact = isPerson && f.contactName.trim() ? {
      name: f.contactName.trim(), title: f.contactTitle.trim(), email: f.contactEmail.trim(),
      phone: f.contactPhone.trim(), is_decision_maker: f.isDecisionMaker,
      preferred_contact_method: f.preferredContactMethod,
    } : undefined;

    const displayName = isPerson ? f.personName.trim() : f.organizationName.trim();

    const res = await fetch('/api/marketing/prospects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: f.entityType,
        organization_name: f.organizationName.trim() || undefined,
        person_name: isPerson ? f.personName.trim() : undefined,
        brand_name: f.brandName.trim(), industry: f.industry.trim(), website: f.website.trim(),
        main_email: isPerson ? f.personEmail.trim() : undefined,
        main_phone: isPerson ? f.personPhone.trim() : undefined,
        location_count: f.locationCount ? Number(f.locationCount) : undefined,
        source_label: f.sourceRaw.trim() ? classifySourceValue(f.sourceRaw.trim()).leadSource : undefined,
        source_raw_label: f.sourceRaw.trim() || undefined,
        tags: f.tags.map(name => ({ name, color: hashColor(name) })),
        contact: primaryContact,
        additionalContact,
        location: (f.city.trim() || f.country.trim() || f.state.trim())
          ? { city: f.city.trim(), country: f.country.trim(), state: f.state.trim(), is_active: true } : undefined,
        need: {
          title: f.projectTypes.length ? f.projectTypes.map(t => PROJECT_TYPE_LABEL[t]).join(' + ') : 'Initial project need',
          description: [f.notes.trim(), f.budgetRange.trim() && `Budget range: ${f.budgetRange.trim()}`].filter(Boolean).join('\n') || undefined,
          project_types: f.projectTypes, scope_types: f.scopeTypes,
          has_active_project: f.hasActiveProject ?? undefined,
          deadline: f.deadline || undefined, expected_start_date: f.expectedStartDate || undefined,
          layout_available: f.layoutAvailable ?? undefined, site_ready: f.siteReady ?? undefined,
          timing: f.timing || undefined, target_contact_date: f.targetContactDate || undefined,
          region: f.region || undefined, service_line: f.serviceLine || undefined, state: f.state.trim() || undefined,
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setSaving(false); toast.error(body.error ?? 'Failed to save lead'); return; }
    feedback.success('Lead saved', { description: `${displayName} was added to Contacts.` });
    if (Array.isArray(body.duplicates) && body.duplicates.length) {
      toast.warning(`Possible duplicate of "${body.duplicates[0].display_name}" — review after saving.`);
    }

    if (body?.need?.id && (layoutFile || matterportUrl.trim())) {
      const basePath = `/api/marketing/prospects/${body.prospect.id}/needs/${body.need.id}/documents`;
      if (layoutFile) {
        const form = new FormData();
        form.append('category', 'layout');
        form.append('file', layoutFile);
        const upRes = await fetch(basePath, { method: 'POST', body: form }).catch(() => null);
        if (!upRes?.ok) toast.warning('Lead saved, but the layout file could not be attached — add it from the Need afterward.');
      }
      if (matterportUrl.trim()) {
        const form = new FormData();
        form.append('category', 'matterport');
        form.append('url', matterportUrl.trim());
        const upRes = await fetch(basePath, { method: 'POST', body: form }).catch(() => null);
        if (!upRes?.ok) toast.warning('Lead saved, but the link could not be attached — add it from the Need afterward.');
      }
    }

    setSaving(false);
    router.push(`/marketing/prospects/${body.prospect.id}?tab=needs`);
  }

  const stepTitle = step === 2 && isPerson ? 'Alternate Contact (Optional)' : STEPS[step];
  const previewName = (isPerson ? f.personName : f.organizationName).trim();
  const previewRows: { key: string; value: string }[] = [
    { key: 'Lead Type', value: f.entityType ? ENTITY_TYPE_LABEL[f.entityType] : '' },
    { key: 'Name', value: previewName },
    { key: 'State', value: f.state.trim() },
    { key: 'Source', value: f.sourceRaw.trim() },
    { key: 'Business Type', value: f.industry.trim() },
    { key: 'Region', value: REGIONS.find(r => r.code === f.region)?.label ?? '' },
    { key: 'Due Date', value: f.targetContactDate || f.deadline },
  ];

  return (
    <div className="new-project-wrapper">
      <style>{NEW_PROJECT_STYLES}</style>

      <div className="np-body" style={{ gap: 18 }}>
        <div className="np-top-header-left">
          <h1 className="np-title">Capture New Contact</h1>
          <p className="np-subtitle">
            Nothing here creates a project, reserves a project number, or touches Dropbox — that happens only once Sales accepts an Opportunity handoff.
          </p>
        </div>

        <div className="np-progress" aria-label="Form progress">
          {STEPS.map((label, i) => (
            <div
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={`np-progress-step${i === step ? ' active' : ''}${i < step ? ' completed' : ''}`}
              style={{ cursor: 'default' }}
            >
              <span className="np-progress-marker">{i < step ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
              <span>{i === 2 && isPerson ? 'Alternate Contact (Optional)' : label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="np-main-grid">
      <div className="np-card step-content-card">
        <div>
          <div className="step-card-header">
            <h2 className="np-card-title">{stepTitle}</h2>
          </div>

          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 353 }}>
              <div>
                <span className="form-label">Lead Type</span>
                <div className="np-cat-row" role="group" aria-label="Lead type">
                  {ENTITY_TYPES.map(t => (
                    <Chip key={t} wide active={f.entityType === t} onClick={() => set('entityType', t)}>{ENTITY_TYPE_LABEL[t]}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <span className="form-label">Where did we meet this lead?</span>
                <SourceSelect value={f.sourceRaw || null} options={sourceOptions} onChange={v => set('sourceRaw', v)} placeholder="Select" />
              </div>
              <div>
                <span className="form-label">Tags</span>
                <TagMultiSelect values={f.tags} options={tagOptions} onChange={v => set('tags', v)} placeholder="Add tag…" />
              </div>
            </div>
          )}

          {step === 1 && !isPerson && (
            <div>
              <div className="form-section-title" style={{ marginBottom: 12 }}>Company / Brand</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Company name" required value={f.organizationName} onChange={e => set('organizationName', e.target.value)} autoFocus />
                <TextField label="Brand name" value={f.brandName} onChange={e => set('brandName', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Industry" value={f.industry} onChange={e => set('industry', e.target.value)} />
                <TextField label="Website" value={f.website} onChange={e => set('website', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Number of locations" type="number" min={0} value={f.locationCount} onChange={e => set('locationCount', e.target.value)} />
                <TextField label="Country" value={f.country} onChange={e => set('country', e.target.value)} />
                <TextField label="City" value={f.city} onChange={e => set('city', e.target.value)} />
                <TextField label="State" value={f.state} onChange={e => set('state', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <CheckboxField label="Multiple addresses" checked={f.multipleAddresses} onChange={v => set('multipleAddresses', v)} />
                <CheckboxField label="Existing locations" checked={f.existingLocations} onChange={v => set('existingLocations', v)} />
                <CheckboxField label="Future expansion planned" checked={f.futureExpansion} onChange={v => set('futureExpansion', v)} />
              </div>
            </div>
          )}

          {step === 1 && isPerson && (
            <div>
              <div className="form-section-title" style={{ marginBottom: 12 }}>Person</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Full name" required value={f.personName} onChange={e => set('personName', e.target.value)} autoFocus />
                <TextField label="Occupation or role" value={f.personOccupation} onChange={e => set('personOccupation', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Email" type="email" value={f.personEmail} onChange={e => set('personEmail', e.target.value)} />
                <PhoneField label="Phone" value={f.personPhone} onChange={v => set('personPhone', v)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Country" value={f.country} onChange={e => set('country', e.target.value)} />
                <TextField label="City" value={f.city} onChange={e => set('city', e.target.value)} />
                <TextField label="State" value={f.state} onChange={e => set('state', e.target.value)} />
              </div>
              <TextField label="Company / Organization (optional)" placeholder="If this person is connected to a business" value={f.organizationName} onChange={e => set('organizationName', e.target.value)} />
            </div>
          )}

          {step === 2 && !isPerson && (
            <div>
              <div className="form-grid-2">
                <TextField label="Full Name" value={f.contactName} onChange={e => set('contactName', e.target.value)} autoFocus />
                <TextField label="Occupation/role" value={f.contactTitle} onChange={e => set('contactTitle', e.target.value)} />
                <TextField label="Email Address" type="email" value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
                <PhoneField label="Phone Number" value={f.contactPhone} onChange={v => set('contactPhone', v)} />
              </div>
              <div className="form-grid-2" style={{ alignItems: 'end' }}>
                <SelectField
                  label="Preferred contact method" value={f.preferredContactMethod}
                  onChange={e => set('preferredContactMethod', e.target.value)}
                  options={CONTACT_METHODS.map(m => ({ value: m, label: m }))}
                />
                <div style={{ paddingBottom: 10 }}>
                  <CheckboxField label="Decision maker" checked={f.isDecisionMaker} onChange={v => set('isDecisionMaker', v)} />
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--fg-subtle)', margin: 0 }}>
                Additional contacts can be added from the Lead&apos;s detail page after saving.
              </p>
            </div>
          )}

          {step === 2 && isPerson && (
            // Figma "Alternate Contact (Optional)": someone else connected to this Lead — the
            // person from the previous step is already the primary contact.
            <div className="form-grid-2">
              <TextField label="Full Name" value={f.contactName} onChange={e => set('contactName', e.target.value)} />
              <TextField label="Occupation/role" value={f.contactTitle} onChange={e => set('contactTitle', e.target.value)} />
              <TextField label="Email Address" type="email" value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
              <PhoneField label="Phone Number" value={f.contactPhone} onChange={v => set('contactPhone', v)} />
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="form-section-title" style={{ marginBottom: 8 }}>Region &amp; Service line</div>
              <p style={{ fontSize: 11.5, color: 'var(--fg-subtle)', margin: '0 0 8px' }}>
                Set once here — needed before a project folder can be created once this Need has evidence attached.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <SelectField label="Region" required value={f.region} onChange={e => set('region', e.target.value)}
                  options={REGIONS.map(r => ({ value: r.code, label: r.label }))} />
                <SelectField label="Service line" value={f.serviceLine} onChange={e => set('serviceLine', e.target.value)}
                  options={SERVICE_LINES.map(s => ({ value: s.value, label: s.label }))} />
              </div>
              <div className="form-section-title" style={{ marginBottom: 8 }}>Project type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }} role="group" aria-label="Project type">
                {PROJECT_TYPES.map(t => (
                  <Chip key={t} active={f.projectTypes.includes(t)} onClick={() => set('projectTypes', f.projectTypes.includes(t) ? f.projectTypes.filter(x => x !== t) : [...f.projectTypes, t])}>
                    {PROJECT_TYPE_LABEL[t]}
                  </Chip>
                ))}
              </div>
              <div className="form-section-title" style={{ marginBottom: 8 }}>Scope</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }} role="group" aria-label="Scope">
                {SCOPE_TYPES.map(t => (
                  <Chip key={t} active={f.scopeTypes.includes(t)} onClick={() => set('scopeTypes', f.scopeTypes.includes(t) ? f.scopeTypes.filter(x => x !== t) : [...f.scopeTypes, t])}>
                    {SCOPE_TYPE_LABEL[t]}
                  </Chip>
                ))}
              </div>
              <ToggleRow label="Has an active project?" value={f.hasActiveProject} onChange={v => set('hasActiveProject', v)} />
              <ToggleRow label="Layout / drawings available?" value={f.layoutAvailable} onChange={v => set('layoutAvailable', v)} />
              <ToggleRow label="Site ready?" value={f.siteReady} onChange={v => set('siteReady', v)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0' }}>
                <TextField label="Deadline" type="date" value={f.deadline} onChange={e => set('deadline', e.target.value)} />
                <TextField label="Expected start date" type="date" value={f.expectedStartDate} onChange={e => set('expectedStartDate', e.target.value)} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <TextField label="Budget range" placeholder="e.g. $50k–100k" value={f.budgetRange} onChange={e => set('budgetRange', e.target.value)} />
              </div>
              <TextAreaField label="Notes" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          )}

          {step === 4 && (
            // Figma "Classification": Timing + evidence on one step. The classification itself is
            // computed from the answers (badge + reasons in Contact Preview) — no manual override.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <span className="form-label required">Timing</span>
                <div className="np-cat-row" role="group" aria-label="Timing">
                  {TIMINGS.map(t => (
                    <Chip key={t} active={f.timing === t} onClick={() => set('timing', t)}>{TIMING_LABEL[t]}</Chip>
                  ))}
                </div>
                {f.timing === 'contact_later' && (
                  <div style={{ maxWidth: 240, marginTop: 16 }}>
                    <TextField label="Target contact date" required type="date" value={f.targetContactDate} onChange={e => set('targetContactDate', e.target.value)} />
                  </div>
                )}
              </div>

              <div>
                <span className="form-label">Evidence (Optional)</span>
                <div className="np-evidence">
                  <div className="np-evidence-drop">
                    <span className="np-quick-symbol"><FolderOpen size={32} strokeWidth={1.5} aria-hidden /></span>
                    <p className="np-quick-title">Attach Layout File (Optional)</p>
                    {layoutFile ? (
                      <div className="np-evidence-file">
                        <Paperclip size={14} aria-hidden />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layoutFile.name}</span>
                        <button type="button" onClick={() => setLayoutFile(null)} className="btn btn-ghost btn-sm" aria-label="Remove file"><X size={13} /></button>
                      </div>
                    ) : (
                      <label className="btn-primary-navy" style={{ padding: '8px 12px' }}>
                        <Upload size={16} aria-hidden /> Upload first file
                        <input type="file" hidden onChange={e => setLayoutFile(e.target.files?.[0] ?? null)} />
                      </label>
                    )}
                    <p className="np-quick-sub" style={{ fontSize: 12 }}>
                      A layout or drawing they sent — this is what makes it an Opportunity instead of a Potential.
                    </p>
                  </div>
                  <TextField
                    label="Matterport tour or reference link (Optional)"
                    placeholder="https://..."
                    value={matterportUrl}
                    onChange={e => setMatterportUrl(e.target.value)}
                  />
                </div>
              </div>

              {f.timing && (
                <p className="np-subtitle" style={{ fontSize: 12 }}>
                  <strong>Next action:</strong> {suggestion.recommendedNextAction} · <strong>Follow up:</strong> {suggestion.recommendedFollowUpDate}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="step-footer-actions">
          <button
            type="button"
            className="btn-outline-custom muted"
            onClick={() => step === 0 ? router.push('/marketing/prospects') : setStep(s => s - 1)}
          >
            {step === 0 ? 'Cancel' : <><ArrowLeft size={14} aria-hidden /> Back</>}
          </button>
          <div className="step-footer-right">
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn-primary-navy" disabled={!canProceed} onClick={() => setStep(s => s + 1)}>
                Next <ArrowRight size={14} aria-hidden />
              </button>
            ) : (
              <button type="button" className="btn-primary-navy" disabled={saving || !canProceed} onClick={submit}>
                {saving ? 'Saving…' : 'Save to contacts'}
              </button>
            )}
          </div>
        </div>
      </div>

      <aside className="summary-sidebar-card" aria-label="Contact preview">
        <div className="summary-head">
          <h3 className="np-card-title">Contact Preview</h3>
          {/* Suggested classification (computed from the answers, recalculated live). */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span
              className="np-status-badge"
              style={{ background: 'var(--color-secondary-700)', color: '#fff', padding: '2px 12px' }}
            >
              {f.entityType ? LEAD_CLASSIFICATION_LABEL[suggestion.classification] : '-'}
            </span>
            {f.entityType && (
              <span
                title={suggestion.reasons.join('\n')}
                aria-label={`Why: ${suggestion.reasons.join('; ')}`}
                style={{ display: 'inline-flex', color: 'var(--color-secondary-700)' }}
              >
                <Info size={18} aria-hidden />
              </span>
            )}
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
