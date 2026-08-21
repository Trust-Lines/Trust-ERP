'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Paperclip, Link2, X } from 'lucide-react';
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

const STEPS = ['Source', 'Company', 'Contact', 'Project Need', 'Timing', 'Classification'] as const;
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
function SelectField({ label, options, ...props }: { label: string; options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="form-label" style={{ fontSize: 12 }}>{label}</label>
      <select id={id} className="form-input" {...props}>
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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
function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active}
      className="pill"
      style={{
        cursor: 'pointer', border: `1px solid ${active ? 'var(--brand-navy)' : 'var(--border-default)'}`,
        background: active ? 'var(--brand-navy)' : 'white', color: active ? 'white' : 'var(--fg-default)',
        fontSize: 12, padding: '6px 12px',
      }}
    >
      {active && <Check size={12} />} {children}
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
    toast.success(`"${displayName}" saved to Lead Cloud`);
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
                fontSize: 12, fontWeight: i === step ? 700 : 500,
                background: i === step ? 'var(--brand-navy)' : i < step ? 'var(--status-success-bg)' : 'var(--bg-subtle)',
                color: i === step ? 'white' : i < step ? 'var(--status-success-fg)' : 'var(--fg-subtle)',
              }}
            >
              {i < step ? <Check size={12} /> : <span>{i + 1}</span>} {label}
            </div>
            {i < STEPS.length - 1 && <div style={{ width: 16, height: 1, background: 'var(--border-subtle)' }} />}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          {step === 0 && (
            <div>
              <div className="form-section-title" style={{ marginBottom: 12 }}>Lead type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }} role="group" aria-label="Lead type">
                {ENTITY_TYPES.map(t => (
                  <Chip key={t} active={f.entityType === t} onClick={() => set('entityType', t)}>{ENTITY_TYPE_LABEL[t]}</Chip>
                ))}
              </div>
              <div className="form-section-title" style={{ marginBottom: 8 }}>How did we meet this lead?</div>
              <div style={{ marginBottom: 20 }}>
                <SourceSelect value={f.sourceRaw || null} options={sourceOptions} onChange={v => set('sourceRaw', v)} placeholder="Select or type a source…" />
              </div>
              <div className="form-section-title" style={{ marginBottom: 8 }}>Tags</div>
              <TagMultiSelect values={f.tags} options={tagOptions} onChange={v => set('tags', v)} placeholder="Add tag…" />
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
                <TextField label="Phone" value={f.personPhone} onChange={e => set('personPhone', e.target.value)} />
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
              <div className="form-section-title" style={{ marginBottom: 12 }}>Contact</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Name" value={f.contactName} onChange={e => set('contactName', e.target.value)} autoFocus />
                <TextField label="Job title" value={f.contactTitle} onChange={e => set('contactTitle', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Email" type="email" value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
                <TextField label="Phone" value={f.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10, alignItems: 'end' }}>
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
            <div>
              <div className="form-section-title" style={{ marginBottom: 4 }}>Additional contact (optional)</div>
              <p style={{ fontSize: 11.5, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
                {f.personName || 'This person'} is already the primary contact — captured in the previous step, not asked again here.
                Add someone else connected to this Lead only if relevant.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Name" value={f.contactName} onChange={e => set('contactName', e.target.value)} />
                <TextField label="Job title" value={f.contactTitle} onChange={e => set('contactTitle', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <TextField label="Email" type="email" value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
                <TextField label="Phone" value={f.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="form-section-title" style={{ marginBottom: 8 }}>Region &amp; Service line</div>
              <p style={{ fontSize: 11.5, color: 'var(--fg-subtle)', margin: '0 0 8px' }}>
                Set once here — needed before a project folder can be created once this Need has evidence attached.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <SelectField label="Region" value={f.region} onChange={e => set('region', e.target.value)}
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
            <div>
              <div className="form-section-title" style={{ marginBottom: 12 }}>Timing</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }} role="group" aria-label="Timing">
                {TIMINGS.map(t => (
                  <Chip key={t} active={f.timing === t} onClick={() => set('timing', t)}>{TIMING_LABEL[t]}</Chip>
                ))}
              </div>
              {f.timing === 'contact_later' && (
                <div style={{ maxWidth: 240 }}>
                  <TextField label="Target contact date" required type="date" value={f.targetContactDate} onChange={e => set('targetContactDate', e.target.value)} />
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div>
              <div className="form-section-title" style={{ marginBottom: 8 }}>Evidence (optional)</div>
              <p style={{ fontSize: 11.5, color: 'var(--fg-subtle)', margin: '0 0 10px' }}>
                If they sent a layout, or you have a Matterport tour or reference link — attach it here.
                This is the ONLY thing that makes it an Opportunity instead of a Potential.
              </p>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {layoutFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <Paperclip size={14} color="var(--brand-teal)" />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layoutFile.name}</span>
                      <button type="button" onClick={() => setLayoutFile(null)} className="btn btn-ghost btn-sm" aria-label="Remove file"><X size={13} /></button>
                    </div>
                  ) : (
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', alignSelf: 'flex-start' }}>
                      <Paperclip size={13} /> Attach layout file
                      <input type="file" hidden onChange={e => setLayoutFile(e.target.files?.[0] ?? null)} />
                    </label>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link2 size={14} color="var(--fg-subtle)" style={{ flexShrink: 0 }} />
                    <input className="form-input" placeholder="Matterport tour or reference link (https://…)"
                      value={matterportUrl} onChange={e => setMatterportUrl(e.target.value)} style={{ fontSize: 13 }} />
                  </div>
                </div>
              </div>

              <div className="form-section-title" style={{ marginBottom: 12 }}>Classification preview</div>
              <div className="card" style={{ background: 'var(--bg-subtle)', marginBottom: 16 }}>
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span className="pill" style={{ background: 'var(--brand-navy)', color: 'white', fontSize: 13, padding: '5px 12px' }}>
                      {LEAD_CLASSIFICATION_LABEL[suggestion.classification]}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>suggested classification</span>
                  </div>
                  <div style={{ fontSize: 12.5, marginBottom: 8 }}>
                    <strong>Reasons:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {suggestion.reasons.map(r => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                  <div style={{ fontSize: 12.5 }}><strong>Recommended next action:</strong> {suggestion.recommendedNextAction}</div>
                  <div style={{ fontSize: 12.5 }}><strong>Recommended follow-up date:</strong> {suggestion.recommendedFollowUpDate}</div>
                </div>
              </div>

              <p style={{ fontSize: 11.5, color: 'var(--fg-subtle)', margin: 0 }}>
                This is computed automatically from your answers — there is no manual override. If a
                Lead qualifies as an Opportunity Candidate, an Opportunity is created for it automatically;
                the classification is recalculated any time the underlying answers change (e.g. from the
                Lead&apos;s detail page).
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={() => step === 0 ? router.push('/marketing/prospects') : setStep(s => s - 1)}>
          <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" disabled={!canProceed} onClick={() => setStep(s => s + 1)}>
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Save to Lead Cloud'}
          </button>
        )}
      </div>
    </div>
  );
}
