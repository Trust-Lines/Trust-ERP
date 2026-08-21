'use client';

import { useMemo, useState } from 'react';
import { Palette, Plus, ChevronDown, ExternalLink, UserPlus, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Pill } from '@/components/platform/shared/Pill';
import type { SalesDesignJob, SalesDesignVersion } from '@/types/database';

export interface DesignerOption { id: string; full_name: string; office: string | null }

interface Props {
  initialJobs: SalesDesignJob[];
  initialVersions: SalesDesignVersion[];
  designers: DesignerOption[];
  canManage: boolean;
  canInviteDesigner?: boolean;
  schemaError?: string | null;
  leadStatus?: string | null;
  designFiles?: Record<string, { id: string; version_id: string; file_name: string }[]>;
}

const TRIGGER_STATUS = 'working_on_it_trust';

const JOB_STATUSES = [
  'awaiting_assignment', 'assigned', 'working_on_it', 'ready_for_sales_review',
  'revision_requested', 'approved_by_sales', 'presented_to_customer', 'completed', 'cancelled',
];
const VER_STATUSES = ['draft', 'submitted', 'presented', 'approved', 'revision_requested', 'rejected'];
const cap = (s: string) => s.replace(/_/g, ' ');

const designerLabel = (d: DesignerOption) => (d.office ? `${d.full_name} — ${d.office}` : d.full_name);

function StatusPill({ status }: { status: string }) {
  const good = ['approved_by_sales', 'completed', 'approved'].includes(status);
  const warn = ['revision_requested', 'rejected', 'cancelled', 'awaiting_assignment'].includes(status);
  return <Pill variant={good ? 'success' : warn ? 'warning' : 'neutral'}><span style={{ textTransform: 'capitalize' }}>{cap(status)}</span></Pill>;
}

export function SalesDesignCard({ initialJobs, initialVersions, designers: initialDesigners, canManage, canInviteDesigner, schemaError, leadStatus, designFiles = {} }: Props) {
  const [jobs, setJobs] = useState<SalesDesignJob[]>(initialJobs);
  const [versions, setVersions] = useState<SalesDesignVersion[]>(initialVersions);
  const [designers, setDesigners] = useState<DesignerOption[]>(initialDesigners);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initialJobs.map(j => j.id)));
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function inviteDesigner(jobId: string, full_name: string, email: string, office: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name, email, role: 'designer', office: office || null }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok || !b.userId) { toast.error(b.error ?? 'Invite failed'); return; }

      const added: DesignerOption = { id: b.userId, full_name, office: office || null };
      setDesigners(p => p.some(d => d.id === added.id) ? p : [...p, added].sort((a, c) => a.full_name.localeCompare(c.full_name)));
      setInviteFor(null);

      if (b.emailSent === false) {
        toast.warning(`${full_name} was added and assigned, but the invite email could not be sent. Ask them to use “Forgot password”, or configure Supabase SMTP.`);
      } else if (b.alreadyExisted) {
        toast.success(`${full_name} already had an account — role updated to designer`);
      } else {
        toast.success(`Invite sent to ${email}`);
      }
      await patchJob(jobId, { assigned_designer_id: added.id });
    } finally { setBusy(false); }
  }

  const nameOf = useMemo(() => {
    const m = new Map(designers.map(d => [d.id, designerLabel(d)]));
    return (id: string | null) => (id ? m.get(id) ?? 'Unknown' : null);
  }, [designers]);

  const versionsByJob = useMemo(() => {
    const m = new Map<string, SalesDesignVersion[]>();
    for (const v of versions) { const a = m.get(v.job_id) ?? []; a.push(v); m.set(v.job_id, a); }
    return m;
  }, [versions]);

  function toggle(id: string) { setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function patchJob(jobId: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setJobs(p => p.map(j => j.id === jobId ? b.job : j));
      toast.success('Design job updated');
    } finally { setBusy(false); }
  }

  async function addVersion(jobId: string, preview_link: string, notes: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/versions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview_link, notes }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setVersions(p => [b.version, ...p]);
      setJobs(p => p.map(j => j.id === jobId && j.status === 'assigned' ? { ...j, status: 'working_on_it' } : j));
      toast.success(`Version V${b.version.version_no} added`);
    } finally { setBusy(false); }
  }

  async function openDesignFile(jobId: string, fileId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/file-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'design', id: fileId }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok || !b.link) { toast.error(b.error ?? 'Could not open file'); return; }
      window.open(b.link, '_blank', 'noopener,noreferrer');
    } finally { setBusy(false); }
  }

  async function patchVersion(jobId: string, versionId: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/versions/${versionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setVersions(p => p.map(v => v.id === versionId ? b.version : v));
      toast.success('Version updated');
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Palette size={15} /> Sales Design</div>
      </div>
      <div className="card-body">
        {schemaError ? (
          <div style={{ fontSize: 13, color: 'var(--status-danger)', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 6, padding: '10px 12px' }}>
            {schemaError}
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>
            {leadStatus === TRIGGER_STATUS ? (
              <>The lead is at <strong style={{ color: 'var(--fg-default)' }}>Working on it Trust</strong> but no design
              job exists yet. Reload this page — it will be created automatically.</>
            ) : (
              <>No design job yet. A design job will be created when the lead status becomes{' '}
              <strong style={{ color: 'var(--fg-default)' }}>Working on it Trust</strong>.</>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.map(job => {
              const jv = versionsByJob.get(job.id) ?? [];
              const open = expanded.has(job.id);
              const designerName = nameOf(job.assigned_designer_id);
              return (
                <div key={job.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }} onClick={() => toggle(job.id)}>
                    <ChevronDown size={15} style={{ color: 'var(--fg-subtle)', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{job.title}</span>
                        <StatusPill status={job.status} />
                        {job.priority === 'high' && <span style={{ fontSize: 10, color: 'var(--status-danger)', fontWeight: 700 }}>HIGH</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>
                        {designerName ?? <span style={{ color: 'var(--status-warning)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><UserPlus size={11} /> Awaiting designer assignment</span>}
                        {job.due_date ? ` · due ${job.due_date}` : ''} · {jv.length} version{jv.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {open && (
                    <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                      {job.brief && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '10px 0' }}>{job.brief}</div>}

                      {canManage && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
                          <label style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Designer
                            <select className="form-input" style={{ fontSize: 12, marginTop: 2, minWidth: 220 }}
                              value={job.assigned_designer_id ?? ''} disabled={busy}
                              onChange={e => patchJob(job.id, { assigned_designer_id: e.target.value || null })}>
                              <option value="">— Awaiting assignment</option>
                              {designers.map(d => <option key={d.id} value={d.id}>{designerLabel(d)}</option>)}
                            </select>
                          </label>
                          <label style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Status
                            <select className="form-input" style={{ fontSize: 12, marginTop: 2 }} value={job.status} disabled={busy}
                              onChange={e => patchJob(job.id, { status: e.target.value })}>
                              {JOB_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                            </select>
                          </label>
                          <label style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Priority
                            <select className="form-input" style={{ fontSize: 12, marginTop: 2 }} value={job.priority} disabled={busy}
                              onChange={e => patchJob(job.id, { priority: e.target.value })}>
                              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
                            </select>
                          </label>
                          <label style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Due date
                            <input type="date" className="form-input" style={{ fontSize: 12, marginTop: 2 }} defaultValue={job.due_date ?? ''} disabled={busy}
                              onChange={e => patchJob(job.id, { due_date: e.target.value || null })} />
                          </label>
                          {canInviteDesigner && inviteFor !== job.id && (
                            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end', fontSize: 12, color: 'var(--brand-teal)' }}
                              onClick={() => setInviteFor(job.id)} disabled={busy}>
                              <Mail size={12} /> Invite designer
                            </button>
                          )}
                        </div>
                      )}

                      {designers.length === 0 && canManage && inviteFor !== job.id && (
                        <div style={{ fontSize: 11, color: 'var(--status-warning)', marginBottom: 8 }}>
                          No one holds the <strong>designer</strong> role yet.{' '}
                          {canInviteDesigner
                            ? 'Invite a designer above — they’ll be assignable as soon as the invite is sent.'
                            : 'Ask a Sales Manager, Ops Manager or General Manager to invite one.'}
                        </div>
                      )}

                      {inviteFor === job.id && canInviteDesigner && (
                        <InviteDesignerForm busy={busy}
                          onInvite={(n, e, o) => inviteDesigner(job.id, n, e, o)}
                          onCancel={() => setInviteFor(null)} />
                      )}

                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '8px 0 6px' }}>Versions</div>
                      {jv.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-faint)', marginBottom: 8 }}>No versions yet.</div>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {jv.map(v => (
                          <div key={v.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>V{v.version_no}</span>
                              <StatusPill status={v.status} />
                              {v.preview_link && <a href={v.preview_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Preview <ExternalLink size={11} /></a>}
                              {v.presented_at && <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>presented {new Date(v.presented_at).toLocaleDateString()}</span>}
                              <div style={{ flex: 1 }} />
                              {canManage && (
                                <select className="form-input" style={{ fontSize: 12, width: 'auto', padding: '2px 6px' }} value={v.status} disabled={busy}
                                  onChange={e => patchVersion(job.id, v.id, { status: e.target.value })} aria-label={`V${v.version_no} status`}>
                                  {VER_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                                </select>
                              )}
                            </div>
                            {(designFiles[v.id] ?? []).length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                {(designFiles[v.id] ?? []).map(f => (
                                  <button key={f.id} className="btn btn-ghost btn-sm" disabled={busy}
                                    style={{ border: '1px solid var(--border-subtle)', fontSize: 12 }}
                                    onClick={() => openDesignFile(job.id, f.id)}>
                                    <FileText size={12} /> {f.file_name}
                                  </button>
                                ))}
                              </div>
                            )}
                            {v.notes && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 4 }}>{v.notes}</div>}
                            {canManage && (v.status === 'revision_requested' || v.customer_feedback) && (
                              <FeedbackRow value={v.customer_feedback ?? ''} busy={busy} onSave={fb => patchVersion(job.id, v.id, { customer_feedback: fb })} />
                            )}
                          </div>
                        ))}
                      </div>

                      {canManage && <AddVersionRow busy={busy} onAdd={(link, notes) => addVersion(job.id, link, notes)} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const OFFICE_SUGGESTIONS = ['Trust Lines Türkiye', 'Syria Office'];

function InviteDesignerForm({ busy, onInvite, onCancel }: {
  busy: boolean; onInvite: (fullName: string, email: string, office: string) => void; onCancel: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [office, setOffice] = useState('');
  const valid = fullName.trim().length > 1 && /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Mail size={13} /> Invite a designer
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Full name</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. Sara Khaled" value={fullName} onChange={e => setFullName(e.target.value)} autoFocus /></div>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Email</label>
          <input className="form-input" style={{ fontSize: 13 }} type="email" placeholder="sara@…" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Office</label>
          <input className="form-input" style={{ fontSize: 13 }} list="designer-offices" placeholder="e.g. Syria Office" value={office} onChange={e => setOffice(e.target.value)} />
          <datalist id="designer-offices">{OFFICE_SUGGESTIONS.map(o => <option key={o} value={o} />)}</datalist></div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 10 }}>
        They get an email invite, receive the <strong>designer</strong> role, and are assigned to this job right away.
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" disabled={!valid || busy} onClick={() => onInvite(fullName.trim(), email.trim(), office.trim())}>
          {busy ? 'Sending…' : 'Send invite & assign'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

function AddVersionRow({ busy, onAdd }: { busy: boolean; onAdd: (link: string, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  if (!open) return <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, fontSize: 12, color: 'var(--brand-teal)' }} onClick={() => setOpen(true)}><Plus size={12} /> Add version</button>;
  return (
    <div style={{ marginTop: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Preview link (Dropbox / Drive / Matterport)</label><input className="form-input" style={{ fontSize: 13 }} placeholder="https://…" value={link} onChange={e => setLink(e.target.value)} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Notes</label><input className="form-input" style={{ fontSize: 13 }} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { onAdd(link.trim(), notes.trim()); setLink(''); setNotes(''); setOpen(false); }}>Add</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function FeedbackRow({ value, busy, onSave }: { value: string; busy: boolean; onSave: (fb: string) => void }) {
  const [fb, setFb] = useState(value);
  return (
    <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <textarea className="form-input" style={{ fontSize: 12, resize: 'vertical' }} rows={2} placeholder="Customer feedback…" value={fb} onChange={e => setFb(e.target.value)} />
      <button className="btn btn-ghost btn-sm" disabled={busy || fb === value} onClick={() => onSave(fb.trim())}>Save</button>
    </div>
  );
}
