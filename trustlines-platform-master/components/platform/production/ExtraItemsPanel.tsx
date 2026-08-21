'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VendorSelect } from './VendorSelect';
import type { Vendor } from './AddVendorModal';
import { STATUS_CHAIN } from '@/lib/production/board';

const TYPES = ['Millwork', 'Shelving', 'Ceiling', 'Image', 'Furniture', 'Decoration'];
const STATUSES = [...STATUS_CHAIN, 'HOLD_T', 'HOLD_PM', 'ASSEMBLY'];

interface Row {
  id: string;
  project_id: string;
  type: string;
  vendor_id: string | null;
  pf_code: string | null;
  status: string;
  project_code: string;
  project_name: string;
}
interface Proj { id: string; code: string; name: string }

export function ExtraItemsPanel({ source, label, canEdit, onChanged }: {
  source: 'direct_order' | 'missing_extra';
  label: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('Millwork');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/production/extra?source=${source}`, { cache: 'no-store' });
      const json = await res.json() as { rows?: Row[]; projects?: Proj[]; vendors?: Vendor[] };
      setRows(json.rows ?? []);
      setProjects(json.projects ?? []);
      setVendors(json.vendors ?? []);
    } catch {
      setRows([]);
    } finally { setLoading(false); }
  }, [source]);

  useEffect(() => { void load(); }, [load]);

  async function addRow() {
    if (!projectId) { toast.error('Pick a project'); return; }
    setAdding(true);
    const res = await fetch('/api/production/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, type, source }),
    });
    const body = await res.json().catch(() => ({}));
    setAdding(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed to add'); return; }
    toast.success(`${label} row added`);
    setProjectId('');
    await load(); onChanged();
  }

  async function patchRow(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/production/items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    await load(); onChanged();
  }

  async function removeRow(id: string) {
    if (!confirm('Delete this row?')) return;
    const res = await fetch(`/api/production/items/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    toast.success('Row deleted');
    await load(); onChanged();
  }

  const vendorDisplay = (vid: string | null) => {
    if (!vid) return '';
    const v = vendors.find(x => x.id === vid);
    return v ? `${v.code} — ${v.name}` : '';
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-body" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Manage {label}</h3>
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>
              Project
              <select className="form-input" value={projectId} onChange={e => setProjectId(e.target.value)} style={{ minWidth: 260 }}>
                <option value="">— select project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>
              Type
              <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <button className="btn btn-primary btn-sm" onClick={addRow} disabled={adding}>
              {adding ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />} Add row
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} /></div>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--fg-subtle)', fontSize: 13, margin: 0 }}>No {label.toLowerCase()} rows yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px' }}>Project</th>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px' }}>Vendor</th>
                  <th style={{ padding: '8px 10px' }}>PF code</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px' }}><strong>{r.project_code}</strong> <span style={{ color: 'var(--fg-subtle)' }}>{r.project_name}</span></td>
                    <td style={{ padding: '8px 10px' }}>{r.type}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {canEdit ? (
                        <VendorSelect
                          vendors={vendors}
                          displayValue={vendorDisplay(r.vendor_id)}
                          onPick={v => patchRow(r.id, { vendor_id: v.id })}
                          onClear={() => patchRow(r.id, { vendor_id: null })}
                          onAddNew={() => toast.info('Add vendors from the Suppliers page')}
                        />
                      ) : (vendorDisplay(r.vendor_id) || '—')}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--fg-subtle)' }}>{r.pf_code ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {canEdit ? (
                        <select className="form-input" value={r.status} onChange={e => patchRow(r.id, { status: e.target.value })} style={{ fontSize: 11 }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : r.status}
                    </td>
                    {canEdit && <td style={{ padding: '8px 10px', textAlign: 'right' }}><button className="btn btn-ghost btn-sm" onClick={() => removeRow(r.id)} title="Delete"><Trash2 size={14} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
