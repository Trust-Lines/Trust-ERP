'use client';

import { useState } from 'react';
import { Select } from '@/components/platform/shared/Select';
import { PROJECT_TYPE_LABEL, TIMING_LABEL, TIMINGS, PROJECT_TYPES } from '@/lib/marketing/classification';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import type { ProjectType, LeadTiming } from '@/types/database';
import { locationLabel, type Need, type ProspectLocation } from './types';

export function NeedForm({ initial, defaultRegion, locations, onSave, onCancel }: { initial?: Need; defaultRegion?: string | null; locations: ProspectLocation[]; onSave: (n: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [locationId, setLocationId] = useState(initial?.location_id ?? '');
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>(initial?.project_types ?? []);
  const [hasActiveProject, setHasActiveProject] = useState<boolean | null>(initial?.has_active_project ?? null);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [expectedStartDate, setExpectedStartDate] = useState(initial?.expected_start_date ?? '');
  const [layoutAvailable, setLayoutAvailable] = useState<boolean | null>(initial?.layout_available ?? null);
  const [budgetMin, setBudgetMin] = useState(initial?.budget_min?.toString() ?? '');
  const [budgetMax, setBudgetMax] = useState(initial?.budget_max?.toString() ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? '');
  const [timing, setTiming] = useState<LeadTiming | ''>(initial?.timing ?? '');
  const [targetContactDate, setTargetContactDate] = useState(initial?.target_contact_date ?? '');
  // A new Need defaults to the Contact's own region — the authoritative "who owns this"
  // field elsewhere in the app — so it takes a deliberate override to route a Need's
  // documents to a different region's Dropbox folder than its Contact actually lives in.
  const [region, setRegion] = useState(initial?.region ?? defaultRegion ?? '');
  const [serviceLine, setServiceLine] = useState(initial?.service_line ?? '');
  const [state, setState] = useState(initial?.state ?? '');
  const [saving, setSaving] = useState(false);

  function togglePill<T>(list: T[], v: T, setList: (l: T[]) => void) {
    setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  }

  async function submit() {
    if (!title.trim()) return;
    if (timing === 'contact_later' && !targetContactDate) return;
    setSaving(true);
    await onSave({
      title: title.trim(), description: description.trim() || undefined,
      location_id: locationId || undefined,
      project_types: projectTypes, has_active_project: hasActiveProject ?? undefined,
      deadline: deadline || undefined, expected_start_date: expectedStartDate || undefined,
      layout_available: layoutAvailable ?? undefined,
      budget_min: budgetMin ? Number(budgetMin) : undefined,
      budget_max: budgetMax ? Number(budgetMax) : undefined,
      currency: currency.trim() || undefined,
      timing: timing || undefined, target_contact_date: targetContactDate || undefined,
      region: region || undefined, service_line: serviceLine || undefined, state: state.trim() || undefined,
    });
    setSaving(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label className="form-label required" style={{ fontSize: 12 }}>Title</label>
        <input className="form-input" placeholder="e.g. Manhattan Full Remodel" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Project type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PROJECT_TYPES.map(t => (
            <button key={t} type="button" onClick={() => togglePill(projectTypes, t, setProjectTypes)}
              className="pill" style={{ cursor: 'pointer', border: 'none', background: projectTypes.includes(t) ? 'var(--brand-navy)' : 'var(--bg-subtle)', color: projectTypes.includes(t) ? 'white' : 'var(--fg-subtle)', fontSize: 11 }}>
              {PROJECT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {locations.length > 0 && (
        <div style={{ marginBottom: 10, maxWidth: 320 }}>
          <label className="form-label" style={{ fontSize: 12 }}>Location</label>
          <Select className="form-input" value={locationId} onChange={e => setLocationId(e.target.value)}>
            <option value="">— Not location-specific —</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{locationLabel(l)}</option>
            ))}
          </Select>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Region</label>
          <Select className="form-input" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">—</option>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </Select></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Service line</label>
          <Select className="form-input" value={serviceLine} onChange={e => setServiceLine(e.target.value)}>
            <option value="">—</option>
            {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>State</label>
          <input className="form-input" placeholder="e.g. NY" value={state} onChange={e => setState(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Deadline</label>
          <input className="form-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Expected start date</label>
          <input className="form-input" type="date" value={expectedStartDate} onChange={e => setExpectedStartDate(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Budget min</label>
          <input className="form-input" type="number" min={0} value={budgetMin} onChange={e => setBudgetMin(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Budget max</label>
          <input className="form-input" type="number" min={0} value={budgetMax} onChange={e => setBudgetMax(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Currency</label>
          <input className="form-input" placeholder="USD" value={currency} onChange={e => setCurrency(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={hasActiveProject === true} onChange={e => setHasActiveProject(e.target.checked ? true : null)} /> Has an active project
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={layoutAvailable === true} onChange={e => setLayoutAvailable(e.target.checked ? true : null)} /> Layout/drawings available
        </label>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Timing</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TIMINGS.map(t => (
            <button key={t} type="button" onClick={() => setTiming(t)}
              className="pill" style={{ cursor: 'pointer', border: 'none', background: timing === t ? 'var(--brand-navy)' : 'var(--bg-subtle)', color: timing === t ? 'white' : 'var(--fg-subtle)', fontSize: 11 }}>
              {TIMING_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {timing === 'contact_later' && (
        <div style={{ marginBottom: 10, maxWidth: 220 }}>
          <label className="form-label required" style={{ fontSize: 12 }}>Target contact date</label>
          <input className="form-input" type="date" value={targetContactDate} onChange={e => setTargetContactDate(e.target.value)} />
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ fontSize: 12 }}>Description</label>
        <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!title.trim() || saving || (timing === 'contact_later' && !targetContactDate)}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save need'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

