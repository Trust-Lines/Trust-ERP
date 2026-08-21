'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle, Contact, X, Plus, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { HandoverChecklistItem, ProjectHandover } from '@/types/database';

interface Summary {
  tlines_pm: string | null; trustlines_pm: string | null; ops_manager: string | null; pm_supervisor: string | null;
  dropbox_root_path: string | null; closed_deal_date: string | null; deal_value: number | null; currency: string | null; scope_summary: string | null;
}
interface Attached { id: string; customer_contact_id: string; role_on_project: string | null; is_primary: boolean }
interface ContactInfo { id: string; name: string; title: string | null; email: string | null; phone: string | null }
interface AvailContact { id: string; name: string; title: string | null }

interface Props {
  projectId: string; projectCode: string; projectName: string; canEdit: boolean;
  summary: Summary;
  initialHandover: ProjectHandover | null;
  template: HandoverChecklistItem[];
  derived: Record<string, boolean>;
  autoKeys: string[];
  customer: { id: string; name: string } | null;
  initialAttached: Attached[];
  contactMap: Record<string, ContactInfo>;
  initialAvailable: AvailContact[];
}

export function HandoverClient(props: Props) {
  const { projectId, projectCode, projectName, canEdit, summary, template, derived, autoKeys, customer, contactMap } = props;
  const [handover, setHandover] = useState<ProjectHandover | null>(props.initialHandover);
  const [attached, setAttached] = useState<Attached[]>(props.initialAttached);
  const [available, setAvailable] = useState<AvailContact[]>(props.initialAvailable);
  const [busy, setBusy] = useState(false);

  const auto = new Set(autoKeys);
  const rawChecklist: HandoverChecklistItem[] = handover?.checklist ?? template;
  const checklist = rawChecklist.map(i => auto.has(i.key) ? { ...i, done: !!derived[i.key] } : i);
  const doneCount = checklist.filter(i => i.done).length;
  const complete = handover?.status === 'complete';

  async function patch(bodyObj: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/handover`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Failed'); return null; }
      setHandover(body.handover);
      return body.handover as ProjectHandover;
    } finally { setBusy(false); }
  }

  async function attach(c: AvailContact) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/customer-contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerContactId: c.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Failed to attach'); return; }
      setAttached(prev => [...prev, body.link]);
      setAvailable(prev => prev.filter(a => a.id !== c.id));
      toast.success(`Attached ${c.name}`);
    } finally { setBusy(false); }
  }

  async function detach(a: Attached) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/customer-contacts/${a.id}`, { method: 'DELETE' });
      if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed to detach'); return; }
      setAttached(prev => prev.filter(x => x.id !== a.id));
      const ci = contactMap[a.customer_contact_id];
      if (ci) setAvailable(prev => [...prev, { id: ci.id, name: ci.name, title: ci.title }].sort((x, y) => x.name.localeCompare(y.name)));
      toast.success('Detached');
    } finally { setBusy(false); }
  }

  const money = summary.deal_value != null ? `${summary.currency ?? ''} ${Number(summary.deal_value).toLocaleString()}`.trim() : '—';

  return (
    <>
      <Link href={`/projects/${projectId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 16, textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Back to project
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Project Handover</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{projectCode} — {projectName}</p>
        </div>
        <span className="pill" style={{ background: complete ? 'var(--status-success-bg)' : 'var(--bg-sunken)', color: complete ? 'var(--status-success-fg)' : 'var(--fg-subtle)', fontSize: 11 }}>
          {complete ? 'Handover complete' : `In progress · ${doneCount}/${checklist.length}`}
        </span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><div className="form-section-title">Handover summary</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: 8, columnGap: 12, fontSize: 13 }}>
            {([
              ['T-Lines PM', summary.tlines_pm], ['Trust Lines PM', summary.trustlines_pm],
              ['Ops Manager', summary.ops_manager], ['PM Supervisor', summary.pm_supervisor],
              ['Closed deal date', summary.closed_deal_date], ['Budget', money],
              ['Scope', summary.scope_summary], ['Dropbox', summary.dropbox_root_path],
            ] as [string, string | null][]).map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <div style={{ color: 'var(--fg-subtle)' }}>{k}</div>
                <div style={{ wordBreak: 'break-word' }}>{v || <span style={{ color: 'var(--fg-faint)' }}>—</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Handover checklist</div>
          {canEdit && (complete
            ? <button className="btn btn-ghost btn-sm" onClick={() => patch({ reopen: true })} disabled={busy}>Reopen</button>
            : <button className="btn btn-primary btn-sm" onClick={() => patch({ complete: true })} disabled={busy}><ClipboardCheck size={13} /> Mark complete</button>)}
        </div>
        <div style={{ padding: '10px 18px 0', fontSize: 12, color: 'var(--fg-subtle)' }}>
          Most items tick themselves from the project’s data — <strong>Auto</strong> items turn green the moment the fact
          is true (a PM is assigned, the customer is linked, files exist…). Only judgement items are ticked by hand.
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {checklist.map(item => {
              const isAuto = auto.has(item.key);
              const clickable = canEdit && !busy && !isAuto;
              return (
                <button key={item.key} disabled={!clickable} onClick={() => clickable && patch({ toggle: item.key })}
                  title={isAuto ? 'Set automatically from the project’s data' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', border: 'none', borderBottom: '1px solid var(--border-subtle)', background: 'transparent', cursor: clickable ? 'pointer' : 'default', textAlign: 'left', fontSize: 13 }}>
                  {item.done ? <CheckCircle2 size={17} style={{ color: 'var(--status-success-fg, #15803d)', flexShrink: 0 }} /> : <Circle size={17} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />}
                  <span style={{ color: item.done ? 'var(--fg-subtle)' : 'var(--fg-default)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
                  {isAuto
                    ? <span className="pill" style={{ fontSize: 9, marginLeft: 2, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>Auto</span>
                    : <span className="pill" style={{ fontSize: 9, marginLeft: 2, background: 'var(--status-warning-bg, #fef3c7)', color: 'var(--status-warning-fg, #92400e)' }}>Manual</span>}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="form-label" style={{ fontSize: 12 }}>Handover meeting</label>
              <input type="datetime-local" className="form-input" style={{ fontSize: 13 }} disabled={!canEdit || busy}
                defaultValue={handover?.meeting_at ? handover.meeting_at.slice(0, 16) : ''}
                onChange={e => patch({ meeting_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="form-section-title">Customer & contacts</div></div>
        <div className="card-body">
          {!customer ? (
            <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>
              No customer linked to this project. Link one from the originating lead (Customer card on the lead page).
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Contact size={16} style={{ color: 'var(--fg-subtle)' }} />
                <Link href={`/customers/${customer.id}`} style={{ fontWeight: 600, fontSize: 14 }}>{customer.name}</Link>
              </div>

              <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 6 }}>Attached to this project</div>
              {attached.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--fg-faint)', marginBottom: 12 }}>No contacts attached yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {attached.map(a => {
                    const ci = contactMap[a.customer_contact_id];
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{ci?.name ?? 'Contact'}</span>
                          <span style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>{[ci?.title, ci?.email, ci?.phone].filter(Boolean).length ? ' · ' + [ci?.title, ci?.email, ci?.phone].filter(Boolean).join(' · ') : ''}</span>
                        </div>
                        {canEdit && <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => detach(a)} disabled={busy} aria-label="Detach contact"><X size={13} /></button>}
                      </div>
                    );
                  })}
                </div>
              )}

              {canEdit && available.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 6 }}>Available to attach</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {available.map(c => (
                      <button key={c.id} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border-subtle)' }} onClick={() => attach(c)} disabled={busy}>
                        <Plus size={12} /> {c.name}{c.title ? ` · ${c.title}` : ''}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
