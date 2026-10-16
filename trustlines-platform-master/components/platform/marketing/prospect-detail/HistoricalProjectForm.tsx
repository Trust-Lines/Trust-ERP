'use client';

import { useState } from 'react';
import { Select } from '@/components/platform/shared/Select';
import { PROJECT_TYPE_LABEL, PROJECT_TYPES } from '@/lib/marketing/classification';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import type { ProjectType } from '@/types/database';

export function HistoricalProjectForm({ onSave, onCancel }: { onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [region, setRegion] = useState('');
  const [serviceLine, setServiceLine] = useState('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const [address, setAddress] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = title.trim() && region && serviceLine && projectType;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    await onSave({
      title: title.trim(), region, service_line: serviceLine, project_type: projectType,
      address: address.trim() || undefined, completed_date: completedDate || undefined,
    });
    setSaving(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label className="form-label required" style={{ fontSize: 12 }}>Title</label>
        <input className="form-input" placeholder="e.g. Manhattan Store Fixtures" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="form-label required" style={{ fontSize: 12, marginBottom: 4 }}>Store status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PROJECT_TYPES.map(t => (
            <button key={t} type="button" onClick={() => setProjectType(t)}
              className="pill" style={{ cursor: 'pointer', border: 'none', background: projectType === t ? 'var(--brand-navy)' : 'var(--bg-subtle)', color: projectType === t ? 'white' : 'var(--fg-subtle)', fontSize: 11 }}>
              {PROJECT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Region</label>
          <Select className="form-input" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">—</option>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </Select></div>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Service line</label>
          <Select className="form-input" value={serviceLine} onChange={e => setServiceLine(e.target.value)}>
            <option value="">—</option>
            {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select></div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="form-label" style={{ fontSize: 12 }}>Address</label>
        <input className="form-input" placeholder="Store address" value={address} onChange={e => setAddress(e.target.value)} />
      </div>
      <div style={{ marginBottom: 12, maxWidth: 220 }}>
        <label className="form-label" style={{ fontSize: 12 }}>Completed date</label>
        <input className="form-input" type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!valid || saving}>
          {saving ? 'Saving…' : 'Save project'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

