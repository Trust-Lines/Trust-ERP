'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { STATUS_CHAIN } from '@/lib/production/board';

const STATUSES = [...STATUS_CHAIN, 'HOLD_T', 'HOLD_PM', 'ASSEMBLY'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

interface Row {
  id: string; type: string; status: string; assigned_to: string | null; priority: string | null;
  start_date: string | null; target_date: string | null; vendor_id: string | null; pf_code: string | null;
  order_type: string | null; po_sign_status: string; pf_sign_status: string; pf_usd: number | null; pf_tl: number | null;
}
interface Person { id: string; full_name: string; role: string }
interface Vendor { id: string; code: string | null; name: string }
interface SalesFile { id: string; file_name: string; dropbox_path: string; created_at: string }

interface Props {
  projectId: string; projectCode: string; projectName: string; canEdit: boolean;
  rows: Row[]; people: Person[]; vendors: Vendor[]; salesFiles: SalesFile[]; schemaError: string | null;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_TONE: Record<string, string> = {
  NOT_ORDERED: 'var(--fg-subtle)', SENT: 'var(--status-success-fg)', READY: 'var(--status-success-fg)',
  HOLD_T: 'var(--status-danger-fg, #b91c1c)', HOLD_PM: 'var(--status-danger-fg, #b91c1c)',
};
const PRIORITY_TONE: Record<string, string> = {
  urgent: 'var(--status-danger-fg, #b91c1c)', high: 'var(--status-warning-fg, #92400e)',
  medium: 'var(--fg-default)', low: 'var(--fg-subtle)',
};

export function ProjectTypesClient({ projectId, projectCode, projectName, canEdit, rows, people, vendors, salesFiles, schemaError }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const personName = (uid: string | null) => people.find(p => p.id === uid)?.full_name ?? '—';
  const vendorLabel = (vid: string | null) => { const v = vendors.find(x => x.id === vid); return v ? (v.code ?? v.name) : '—'; };

  async function patch(id: string, field: string, value: string | null) {
    setBusy(id + field);
    const res = await fetch(`/api/production/items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }),
    });
    setBusy(null);
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    router.refresh();
  }

  return (
    <>
      <Link href={`/projects/${projectId}`} className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }}>
        <ArrowLeft size={14} /> Back to project
      </Link>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={22} /> Supply — types
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}><strong>{projectCode}</strong> · {projectName} · each type has its own owner, schedule &amp; sub-status</p>
      </div>

      {schemaError && (
        <div className="card" style={{ padding: 12, marginBottom: 16, borderColor: 'var(--status-warning-fg, #92400e)', fontSize: 13 }}>⚠️ {schemaError}</div>
      )}

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)' }}>
          <Layers size={28} style={{ opacity: 0.4 }} />
          <p style={{ margin: '12px 0 0', fontSize: 14 }}>No types on this project yet. Types are seeded from the project&apos;s categories on the production board.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(r => (
            <div key={r.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{r.type}</h2>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--fg-subtle)' }}>
                  <span>Vendor <strong style={{ color: 'var(--fg-default)' }}>{vendorLabel(r.vendor_id)}</strong></span>
                  <span>PF <strong style={{ color: 'var(--fg-default)', fontFamily: 'monospace' }}>{r.pf_code ?? '—'}</strong></span>
                  <span>Budget <strong style={{ color: 'var(--fg-default)', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(r.pf_usd) || 0)} USD / {fmt(Number(r.pf_tl) || 0)} TL</strong></span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                <Field label="Sub-status">
                  {canEdit ? (
                    <select className="form-input" value={r.status} disabled={busy === r.id + 'status'} onChange={e => patch(r.id, 'status', e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : <span style={{ color: STATUS_TONE[r.status] ?? 'var(--fg-default)', fontWeight: 600 }}>{r.status}</span>}
                </Field>

                <Field label="Owner">
                  {canEdit ? (
                    <select className="form-input" value={r.assigned_to ?? ''} disabled={busy === r.id + 'assigned_to'} onChange={e => patch(r.id, 'assigned_to', e.target.value || null)}>
                      <option value="">— unassigned —</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  ) : personName(r.assigned_to)}
                </Field>

                <Field label="Priority">
                  {canEdit ? (
                    <select className="form-input" value={r.priority ?? ''} disabled={busy === r.id + 'priority'} onChange={e => patch(r.id, 'priority', e.target.value || null)}>
                      <option value="">—</option>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : <span style={{ color: PRIORITY_TONE[r.priority ?? ''] ?? 'var(--fg-subtle)', textTransform: 'capitalize' }}>{r.priority ?? '—'}</span>}
                </Field>

                <Field label="Start date">
                  {canEdit ? <input className="form-input" type="date" value={r.start_date ?? ''} onChange={e => patch(r.id, 'start_date', e.target.value || null)} /> : (r.start_date ?? '—')}
                </Field>

                <Field label="Target date">
                  {canEdit ? <input className="form-input" type="date" value={r.target_date ?? ''} onChange={e => patch(r.id, 'target_date', e.target.value || null)} /> : (r.target_date ?? '—')}
                </Field>

                <Field label="PO / PF sign">
                  <span style={{ fontSize: 12 }}>{r.po_sign_status} / {r.pf_sign_status}</span>
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={15} /> Sales design files
        </h2>
        <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>Design output uploaded during Sales Design — the input for Supply detailing.</p>
        {salesFiles.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>No sales design files linked to this project.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {salesFiles.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
                <strong>{f.file_name}</strong>
                <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>{f.dropbox_path}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--fg-subtle)' }}>
      {label}
      <span style={{ fontSize: 13, color: 'var(--fg-default)' }}>{children}</span>
    </label>
  );
}
