'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { DeliveryPlan, PunchListItem } from '@/types/database';
import { DELIVERY_METHODS, DELIVERY_STATUSES, BUILD_BY } from '@/lib/delivery/config';

export interface SiteReadinessBadge { overall_status: string; target_ready_date: string | null }
export interface ContainerBadge {
  id: string; container_no: string | null; status: string; estimated_arrival_date: string | null;
}

interface Props {
  projectId: string; projectCode: string; projectName: string; canEdit: boolean;
  initialPlan: DeliveryPlan | null;
  initialPunchList: PunchListItem[];
  schemaError: string | null;
  siteReadiness?: SiteReadinessBadge | null;
  containers?: ContainerBadge[];
}

const cap = (s: string) => s.replace(/_/g, ' ');
const label = (k: string) => cap(k).replace(/\b\w/g, c => c.toUpperCase());

const ARRIVED = new Set(['ARRIVED_PORT', 'WAREHOUSE', 'RELEASED', 'COMPLETED']);

export function DeliveryClient({
  projectId, projectCode, projectName, canEdit, initialPlan, initialPunchList, schemaError,
  siteReadiness = null, containers = [],
}: Props) {
  const [plan, setPlan] = useState<DeliveryPlan | null>(initialPlan);
  const [punch, setPunch] = useState<PunchListItem[]>(initialPunchList);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [acceptName, setAcceptName] = useState('');

  const method = plan?.delivery_method ?? 'warehouse';
  const status = plan?.status ?? 'planning';
  const openPunch = punch.filter(p => p.status === 'open').length;
  const completed = status === 'completed';

  async function patchPlan(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/delivery-plan`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setPlan(b.deliveryPlan);
      if (b.completed) toast.success('Project marked delivered & complete');
    } finally { setBusy(false); }
  }

  async function addPunch(title: string, description: string) {
    const res = await fetch(`/api/projects/${projectId}/punch-list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
    setPunch(p => [b.item, ...p]); setAdding(false); toast.success('Punch item added');
  }
  async function togglePunch(item: PunchListItem) {
    const res = await fetch(`/api/projects/${projectId}/punch-list/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: item.status === 'done' ? 'open' : 'done' }) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
    setPunch(p => p.map(x => x.id === item.id ? b.item : x));
  }
  async function delPunch(itemId: string) {
    const res = await fetch(`/api/projects/${projectId}/punch-list/${itemId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    setPunch(p => p.filter(x => x.id !== itemId)); toast.success('Removed');
  }

  const ro = !canEdit || busy;
  const inp = (v: string | null, k: string, type = 'text') => (
    <input type={type} className="form-input" style={{ fontSize: 13 }} defaultValue={v ?? ''} disabled={ro}
      onChange={type === 'date' ? e => patchPlan({ [k]: e.target.value || null }) : undefined}
      onBlur={type !== 'date' ? e => e.target.value !== (v ?? '') && patchPlan({ [k]: e.target.value }) : undefined} />
  );

  return (
    <>
      <Link href={`/projects/${projectId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 16, textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Back to project
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Delivery & Build</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{projectCode} — {projectName}</p>
        </div>
        <span className="pill" style={{ fontSize: 11, textTransform: 'capitalize', background: completed ? 'var(--status-success-bg)' : 'var(--bg-sunken)', color: completed ? 'var(--status-success-fg)' : 'var(--fg-subtle)' }}>{cap(status)}</span>
      </div>

      {schemaError && <div className="card" style={{ marginBottom: 20 }}><div className="card-body" style={{ fontSize: 13, color: '#b91c1c', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6 }}>{schemaError}</div></div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {siteReadiness ? (
          <span
            className="pill"
            style={{
              fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: siteReadiness.overall_status === 'ready' ? 'var(--status-success-bg)' : 'var(--bg-sunken)',
              color: siteReadiness.overall_status === 'ready' ? 'var(--status-success-fg)' : 'var(--fg-subtle)',
            }}
          >
            {siteReadiness.overall_status === 'ready' ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            {siteReadiness.overall_status === 'ready'
              ? 'Site ready'
              : `Site ${cap(siteReadiness.overall_status)}`}
            {siteReadiness.overall_status !== 'ready' && siteReadiness.target_ready_date
              ? ` — target ${siteReadiness.target_ready_date}` : ''}
          </span>
        ) : (
          <span className="pill" style={{ fontSize: 11, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>
            Site readiness not started
          </span>
        )}

        {containers.map(c => (
          <span
            key={c.id}
            className="pill"
            style={{
              fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: ARRIVED.has(c.status) ? 'var(--status-success-bg)' : 'var(--bg-sunken)',
              color: ARRIVED.has(c.status) ? 'var(--status-success-fg)' : 'var(--fg-subtle)',
            }}
          >
            <PackageCheck size={12} />
            {c.container_no ?? 'Container'} — {label(c.status)}
            {!ARRIVED.has(c.status) && c.estimated_arrival_date ? ` — ETA ${c.estimated_arrival_date}` : ''}
          </span>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><div className="form-section-title">Delivery & build plan</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            <div><label className="form-label" style={{ fontSize: 11 }}>Delivery method</label>
              <select className="form-input" style={{ fontSize: 13 }} value={method} disabled={ro} onChange={e => patchPlan({ delivery_method: e.target.value })}>{DELIVERY_METHODS.map(m => <option key={m} value={m}>{label(m)}</option>)}</select></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>Status</label>
              <select className="form-input" style={{ fontSize: 13 }} value={status} disabled={ro} onChange={e => patchPlan({ status: e.target.value })}>{DELIVERY_STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>Installation date</label>{inp(plan?.installation_date ?? null, 'installation_date', 'date')}</div>
            <div><label className="form-label" style={{ fontSize: 11 }}>Built by</label>
              <select className="form-input" style={{ fontSize: 13 }} value={plan?.build_by ?? ''} disabled={ro} onChange={e => patchPlan({ build_by: e.target.value || null })}><option value="">—</option>{BUILD_BY.map(b => <option key={b} value={b}>{label(b)}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label className="form-label" style={{ fontSize: 11 }}>Build schedule</label>{inp(plan?.build_schedule ?? null, 'build_schedule')}</div>
            <div><label className="form-label" style={{ fontSize: 11 }}>Notes</label>{inp(plan?.notes ?? null, 'notes')}</div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: canEdit ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={plan?.site_confirmed ?? false} disabled={ro} onChange={e => patchPlan({ site_confirmed: e.target.checked })} /> Site confirmed ready
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Punch list ({openPunch} open)</div>
          {canEdit && !adding && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}><Plus size={13} /> Add item</button>}
        </div>
        <div className="card-body">
          {adding && canEdit && <div style={{ marginBottom: 12 }}><PunchForm onSave={addPunch} onCancel={() => setAdding(false)} /></div>}
          {punch.length === 0 && !adding ? <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No punch items.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {punch.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', border: '1px solid var(--border-subtle)', borderRadius: 6, opacity: it.status === 'done' ? 0.6 : 1 }}>
                  {canEdit && <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => togglePunch(it)} aria-label={it.status === 'done' ? 'Reopen' : 'Mark done'}>{it.status === 'done' ? <CheckCircle2 size={16} style={{ color: 'var(--status-success-fg, #15803d)' }} /> : <Circle size={16} style={{ color: 'var(--fg-faint)' }} />}</button>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, textDecoration: it.status === 'done' ? 'line-through' : 'none' }}>{it.title}</div>
                    {it.description && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 1 }}>{it.description}</div>}
                  </div>
                  {canEdit && <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => delPunch(it.id)} aria-label="Remove"><Trash2 size={13} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="form-section-title">Customer acceptance & completion</div></div>
        <div className="card-body">
          {plan?.customer_accepted ? (
            <div style={{ fontSize: 13, color: 'var(--status-success-fg, #15803d)', marginBottom: 12 }}>
              ✓ Accepted{plan.accepted_by ? ` by ${plan.accepted_by}` : ''}{plan.accepted_at ? ` on ${new Date(plan.accepted_at).toLocaleDateString()}` : ''}.
              {canEdit && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} disabled={busy} onClick={() => patchPlan({ accept: false })}>Undo</button>}
            </div>
          ) : canEdit ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
              <div><label className="form-label" style={{ fontSize: 11 }}>Accepted by (customer)</label><input className="form-input" style={{ fontSize: 13 }} value={acceptName} onChange={e => setAcceptName(e.target.value)} placeholder="Contact name" /></div>
              <button className="btn btn-secondary btn-sm" disabled={busy || !acceptName.trim()} onClick={() => patchPlan({ accept: true, acceptedBy: acceptName.trim() })}>Record acceptance</button>
            </div>
          ) : <div style={{ fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 12 }}>Not yet accepted.</div>}

          {canEdit && (completed
            ? <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Project is delivered & complete.</div>
            : <button className="btn btn-primary" disabled={busy || openPunch > 0 || !plan?.customer_accepted} onClick={() => patchPlan({ complete: true })}>
                <PackageCheck size={15} /> Mark delivered & complete
              </button>)}
          {!completed && canEdit && (openPunch > 0 || !plan?.customer_accepted) && (
            <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 6 }}>
              {openPunch > 0 && `Close ${openPunch} open punch item${openPunch !== 1 ? 's' : ''}. `}{!plan?.customer_accepted && 'Record customer acceptance first.'}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function PunchForm({ onSave, onCancel }: { onSave: (title: string, description: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 10 }}>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Title</label><input className="form-input" style={{ fontSize: 13 }} value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Description</label><input className="form-input" style={{ fontSize: 13 }} value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" disabled={!title.trim()} onClick={() => onSave(title.trim(), description.trim())}>Add</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
