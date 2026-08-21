'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { Pill } from '@/components/platform/shared/Pill';
import type { ChangeRequest, SiteReadiness, SiteReadinessItem } from '@/types/database';

interface Contact { id: string; name: string }
interface TimelineEvent { kind: string; at: string; title: string; detail?: string }
interface Props {
  projectId: string; projectCode: string; projectName: string; canEdit: boolean;
  initialChangeRequests: ChangeRequest[];
  initialSiteReadiness: SiteReadiness | null;
  siteTemplate: SiteReadinessItem[];
  contacts: Contact[];
  timeline?: TimelineEvent[];
  schemaError: string | null;
}

const EVENT_DOT: Record<string, string> = {
  change_request: 'var(--phase-5)', meeting: 'var(--phase-3)', follow_up: 'var(--phase-6)', stage: 'var(--phase-2)',
};
const EVENT_LABEL: Record<string, string> = {
  change_request: 'Change request', meeting: 'Meeting', follow_up: 'Follow-up', stage: 'Stage',
};

const CR_STATUSES = ['open', 'under_review', 'approved', 'rejected', 'implemented', 'cancelled'];
const CR_CATEGORIES = ['scope', 'design', 'budget', 'timeline', 'material', 'other'];
const OPEN_CR = new Set(['open', 'under_review']);
const cap = (s: string) => s.replace(/_/g, ' ');

function CrStatusPill({ status }: { status: string }) {
  const good = ['approved', 'implemented'].includes(status);
  const warn = ['rejected', 'cancelled', 'open'].includes(status);
  return <Pill variant={good ? 'success' : warn ? 'warning' : 'neutral'}><span style={{ textTransform: 'capitalize' }}>{cap(status)}</span></Pill>;
}

export function FinalizationClient({
  projectId, projectCode, projectName, canEdit,
  initialChangeRequests, initialSiteReadiness, siteTemplate, contacts, timeline = [], schemaError,
}: Props) {
  const [crs, setCrs] = useState<ChangeRequest[]>(initialChangeRequests);
  const [site, setSite] = useState<SiteReadiness | null>(initialSiteReadiness);
  const [addingCr, setAddingCr] = useState(false);
  const [busy, setBusy] = useState(false);

  const checklist = site?.checklist ?? siteTemplate;
  const siteDone = checklist.filter(i => i.done).length;
  const openCount = crs.filter(c => OPEN_CR.has(c.status)).length;
  const nameOf = (id: string | null) => (id ? contacts.find(c => c.id === id)?.name ?? null : null);

  async function createCr(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return false; }
      setCrs(p => [b.changeRequest, ...p]);
      setAddingCr(false);
      toast.success('Change request added');
      return true;
    } finally { setBusy(false); }
  }

  async function patchCr(crId: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-requests/${crId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setCrs(p => p.map(c => c.id === crId ? b.changeRequest : c));
    } finally { setBusy(false); }
  }

  async function deleteCr(crId: string) {
    if (!window.confirm('Remove this change request?')) return;
    const res = await fetch(`/api/projects/${projectId}/change-requests/${crId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to remove'); return; }
    setCrs(p => p.filter(c => c.id !== crId));
    toast.success('Removed');
  }

  async function patchSite(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/site-readiness`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setSite(b.siteReadiness);
    } finally { setBusy(false); }
  }

  const siteStatus = site?.overall_status ?? 'not_ready';

  return (
    <>
      <Link href={`/projects/${projectId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 16, textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Back to project
      </Link>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>PM Finalization</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{projectCode} — {projectName}</p>
      </div>

      {schemaError && (
        <div className="card" style={{ marginBottom: 20 }}><div className="card-body" style={{ fontSize: 13, color: 'var(--status-danger)', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 6 }}>{schemaError}</div></div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Change requests ({openCount} open)</div>
          {canEdit && !addingCr && <button className="btn btn-ghost btn-sm" onClick={() => setAddingCr(true)}><Plus size={13} /> Add change request</button>}
        </div>
        <div className="card-body">
          {addingCr && canEdit && <div style={{ marginBottom: 12 }}><CrForm contacts={contacts} onSave={createCr} onCancel={() => setAddingCr(false)} /></div>}
          {crs.length === 0 && !addingCr ? (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13, padding: '8px 0' }}>No change requests yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {crs.map(cr => (
                <div key={cr.id} style={{ padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6, opacity: ['cancelled', 'rejected'].includes(cr.status) ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{cr.title}</span>
                    <CrStatusPill status={cr.status} />
                    {cr.category && <span className="pill" style={{ fontSize: 10, textTransform: 'capitalize' }}>{cr.category}</span>}
                    <div style={{ flex: 1 }} />
                    {canEdit && (
                      <>
                        <select className="form-input" style={{ fontSize: 12, width: 'auto', padding: '2px 6px' }} value={cr.status}
                          onChange={e => patchCr(cr.id, { status: e.target.value })} disabled={busy} aria-label={`${cr.title} status`}>
                          {CR_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                        </select>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: 'var(--status-danger)' }} onClick={() => deleteCr(cr.id)} aria-label="Remove"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {nameOf(cr.customer_contact_id) && <span>Requested by {nameOf(cr.customer_contact_id)}</span>}
                    {cr.budget_impact != null && <span>Budget: {cr.currency ?? ''} {Number(cr.budget_impact).toLocaleString()}</span>}
                    {cr.timeline_impact_days != null && <span>Timeline: {cr.timeline_impact_days > 0 ? '+' : ''}{cr.timeline_impact_days}d</span>}
                  </div>
                  {cr.description && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 4 }}>{cr.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Site readiness</div>
          <span className="pill" style={{ fontSize: 11, textTransform: 'capitalize',
            background: siteStatus === 'ready' ? 'var(--status-success-bg)' : siteStatus === 'partial' ? 'var(--status-warning-bg, #fef3c7)' : 'var(--bg-sunken)',
            color: siteStatus === 'ready' ? 'var(--status-success-fg)' : siteStatus === 'partial' ? 'var(--status-warning-fg, #92400e)' : 'var(--fg-subtle)' }}>
            {cap(siteStatus)} · {siteDone}/{checklist.length}
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {checklist.map(item => (
              <button key={item.key} disabled={!canEdit || busy} onClick={() => patchSite({ toggle: item.key })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', border: 'none', borderBottom: '1px solid var(--border-subtle)', background: 'transparent', cursor: canEdit ? 'pointer' : 'default', textAlign: 'left', fontSize: 13 }}>
                {item.done ? <CheckCircle2 size={17} style={{ color: 'var(--status-success-fg, #15803d)', flexShrink: 0 }} /> : <Circle size={17} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />}
                <span style={{ color: item.done ? 'var(--fg-subtle)' : 'var(--fg-default)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="form-label" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarClock size={12} /> Target ready date</label>
              <input type="date" className="form-input" style={{ fontSize: 13 }} disabled={!canEdit || busy}
                defaultValue={site?.target_ready_date ?? ''} onChange={e => patchSite({ target_ready_date: e.target.value || null })} />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head"><div className="form-section-title">Communication timeline</div></div>
        <div className="card-body">
          {timeline.length === 0 ? (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13 }}>Nothing recorded yet. Meetings, follow-ups, change requests and stage changes show up here.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {timeline.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < timeline.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: EVENT_DOT[e.kind] ?? 'var(--fg-faint)', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 1 }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>{EVENT_LABEL[e.kind] ?? e.kind}</span>
                      {e.detail ? ` · ${e.detail}` : ''} · {new Date(e.at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CrForm({ contacts, onSave, onCancel }: { contacts: Contact[]; onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [f, setF] = useState({ title: '', description: '', category: '', customer_contact_id: '', budget_impact: '', timeline_impact_days: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.title.trim()) return;
    setSaving(true);
    await onSave({
      title: f.title.trim(), description: f.description.trim() || null,
      category: f.category || null, customer_contact_id: f.customer_contact_id || null,
      budget_impact: f.budget_impact === '' ? null : Number(f.budget_impact),
      timeline_impact_days: f.timeline_impact_days === '' ? null : Number(f.timeline_impact_days),
    });
    setSaving(false);
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Title</label><input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. Move cashier wall" value={f.title} onChange={set('title')} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Category</label>
          <select className="form-input" style={{ fontSize: 13 }} value={f.category} onChange={set('category')}>
            <option value="">—</option>{CR_CATEGORIES.map(c => <option key={c} value={c}>{cap(c)}</option>)}
          </select></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Requested by</label>
          <select className="form-input" style={{ fontSize: 13 }} value={f.customer_contact_id} onChange={set('customer_contact_id')}>
            <option value="">—</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
      </div>
      <div style={{ marginBottom: 8 }}><label className="form-label" style={{ fontSize: 11 }}>Description</label><textarea className="form-input" rows={2} style={{ fontSize: 13, resize: 'vertical' }} value={f.description} onChange={set('description')} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 180px', gap: 8, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Budget impact (Δ)</label><input type="number" step="0.01" className="form-input" style={{ fontSize: 13 }} placeholder="0" value={f.budget_impact} onChange={set('budget_impact')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Timeline impact (days)</label><input type="number" className="form-input" style={{ fontSize: 13 }} placeholder="0" value={f.timeline_impact_days} onChange={set('timeline_impact_days')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!f.title.trim() || saving}>{saving ? 'Saving…' : 'Add'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
