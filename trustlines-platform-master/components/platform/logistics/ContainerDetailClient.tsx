'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { CONTAINER_STATUSES } from '@/lib/logistics/containers';

interface Container {
  id: string; container_no: string | null; booking_no: string | null; carrier: string | null; vessel_name: string | null;
  voyage_no: string | null; origin_port: string | null; destination_port: string | null;
  departure_date: string | null; estimated_arrival_date: string | null; actual_arrival_date: string | null;
  customs_clearance_date: string | null; warehouse_arrival_date: string | null;
  status: string; seal_no: string | null; tracking_url: string | null; notes: string | null;
  delivery_destination: string; job_site_address: string | null;
}
interface CDoc { id: string; doc_type: string | null; name: string; dropbox_path: string | null; url: string | null }
interface ItemPI { pf_code: string | null; type: string; project_code: string | null }
interface Item {
  id: string; production_item_id: string; quantity: number | null; package_count: number | null;
  pallet_count: number | null; gross_weight: number | null; volume_cbm: number | null; notes: string | null;
  production_item: ItemPI | null;
}
interface Avail { id: string; pf_code: string | null; type: string; status: string; project_code: string | null }
interface Props { initialContainer: Container; initialItems: Item[]; initialDocuments: CDoc[]; canEdit: boolean }

const cap = (s: string) => s.replace(/_/g, ' ');
const DOC_TYPES = ['bill_of_lading', 'packing_list', 'customs', 'invoice', 'other'];
const field = (label: string, node: React.ReactNode) => (
  <div><label className="form-label" style={{ fontSize: 11 }}>{label}</label>{node}</div>
);

export function ContainerDetailClient({ initialContainer, initialItems, initialDocuments, canEdit }: Props) {
  const [c, setC] = useState<Container>(initialContainer);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [docs, setDocs] = useState<CDoc[]>(initialDocuments);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [avail, setAvail] = useState<Avail[]>([]);
  const [docForm, setDocForm] = useState<{ open: boolean; name: string; doc_type: string; url: string; dropbox_path: string }>({ open: false, name: '', doc_type: 'bill_of_lading', url: '', dropbox_path: '' });

  async function addDoc() {
    if (!docForm.name.trim()) { toast.error('Document name is required'); return; }
    const res = await fetch(`/api/containers/${c.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: docForm.name, doc_type: docForm.doc_type, url: docForm.url, dropbox_path: docForm.dropbox_path }),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
    setDocs(p => [b.document, ...p]);
    setDocForm({ open: false, name: '', doc_type: 'bill_of_lading', url: '', dropbox_path: '' });
    toast.success('Document attached');
  }

  async function removeDoc(docId: string) {
    if (!confirm('Remove this document link?')) return;
    const res = await fetch(`/api/containers/${c.id}/documents/${docId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    setDocs(p => p.filter(d => d.id !== docId));
    toast.success('Removed');
  }

  async function patch(p: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/containers/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setC(b.container);
    } finally { setBusy(false); }
  }

  async function searchAvailable(q: string) {
    setQuery(q);
    const res = await fetch(`/api/containers/${c.id}/items?available=1&q=${encodeURIComponent(q)}`);
    const b = await res.json().catch(() => ({}));
    setAvail(res.ok ? (b.items ?? []) : []);
  }

  async function loadItem(pi: Avail) {
    setBusy(true);
    try {
      const res = await fetch(`/api/containers/${c.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productionItemId: pi.id }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setItems(p => [...p, { ...b.item, production_item: { pf_code: pi.pf_code, type: pi.type, project_code: pi.project_code } }]);
      setAvail(p => p.filter(a => a.id !== pi.id));
      toast.success('Loaded');
    } finally { setBusy(false); }
  }

  async function unload(itemId: string) {
    const res = await fetch(`/api/containers/${c.id}/items/${itemId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to unload'); return; }
    setItems(p => p.filter(i => i.id !== itemId));
    toast.success('Unloaded');
  }

  const ro = !canEdit || busy;

  return (
    <>
      <Link href="/logistics" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 16, textDecoration: 'none' }}>
        <ArrowLeft size={14} /> All containers
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>{c.container_no || 'Container'}</h1>
        <span className="pill" style={{ fontSize: 11, textTransform: 'capitalize' }}>{cap(c.status.toLowerCase())}</span>
        {c.tracking_url && <a href={c.tracking_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Track <ExternalLink size={12} /></a>}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><div className="form-section-title">Shipment</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
            {field('Status', <select className="form-input" style={{ fontSize: 13 }} value={c.status} disabled={ro} onChange={e => patch({ status: e.target.value })}>{CONTAINER_STATUSES.map(s => <option key={s} value={s}>{cap(s.toLowerCase())}</option>)}</select>)}
            {field('Carrier', <input className="form-input" style={{ fontSize: 13 }} defaultValue={c.carrier ?? ''} disabled={ro} onBlur={e => e.target.value !== (c.carrier ?? '') && patch({ carrier: e.target.value })} />)}
            {field('Vessel', <input className="form-input" style={{ fontSize: 13 }} defaultValue={c.vessel_name ?? ''} disabled={ro} onBlur={e => e.target.value !== (c.vessel_name ?? '') && patch({ vessel_name: e.target.value })} />)}
            {field('Voyage', <input className="form-input" style={{ fontSize: 13 }} defaultValue={c.voyage_no ?? ''} disabled={ro} onBlur={e => e.target.value !== (c.voyage_no ?? '') && patch({ voyage_no: e.target.value })} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr) 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {field('Origin port', <input className="form-input" style={{ fontSize: 13 }} defaultValue={c.origin_port ?? ''} disabled={ro} onBlur={e => e.target.value !== (c.origin_port ?? '') && patch({ origin_port: e.target.value })} />)}
            {field('Destination port', <input className="form-input" style={{ fontSize: 13 }} defaultValue={c.destination_port ?? ''} disabled={ro} onBlur={e => e.target.value !== (c.destination_port ?? '') && patch({ destination_port: e.target.value })} />)}
            {field('Seal #', <input className="form-input" style={{ fontSize: 13 }} defaultValue={c.seal_no ?? ''} disabled={ro} onBlur={e => e.target.value !== (c.seal_no ?? '') && patch({ seal_no: e.target.value })} />)}
            {field('Booking #', <input className="form-input" style={{ fontSize: 13 }} defaultValue={c.booking_no ?? ''} disabled={ro} onBlur={e => e.target.value !== (c.booking_no ?? '') && patch({ booking_no: e.target.value })} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 10 }}>
            {field('Departure', <input type="date" className="form-input" style={{ fontSize: 13 }} defaultValue={c.departure_date ?? ''} disabled={ro} onChange={e => patch({ departure_date: e.target.value || null })} />)}
            {field('ETA', <input type="date" className="form-input" style={{ fontSize: 13 }} defaultValue={c.estimated_arrival_date ?? ''} disabled={ro} onChange={e => patch({ estimated_arrival_date: e.target.value || null })} />)}
            {field('Arrived', <input type="date" className="form-input" style={{ fontSize: 13 }} defaultValue={c.actual_arrival_date ?? ''} disabled={ro} onChange={e => patch({ actual_arrival_date: e.target.value || null })} />)}
            {/* 🔴 FIX (Roadmap Month 3, task 19): customs_clearance_date has been a real, fully
                backend-supported column (migration 058, in the PATCH EDITABLE list) since Logistics
                was built — it was just never rendered here, so "Customs" from the Phase 11 §4 spec
                had no field at all despite a CUSTOMS status already existing in the status chain. */}
            {field('Customs cleared', <input type="date" className="form-input" style={{ fontSize: 13 }} defaultValue={c.customs_clearance_date ?? ''} disabled={ro} onChange={e => patch({ customs_clearance_date: e.target.value || null })} />)}
            {field('Warehouse', <input type="date" className="form-input" style={{ fontSize: 13 }} defaultValue={c.warehouse_arrival_date ?? ''} disabled={ro} onChange={e => patch({ warehouse_arrival_date: e.target.value || null })} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10 }}>
            {field('Delivery destination', <select className="form-input" style={{ fontSize: 13 }} value={c.delivery_destination} disabled={ro} onChange={e => patch({ delivery_destination: e.target.value })}><option value="warehouse">Warehouse</option><option value="direct_job_site">Direct to job site</option></select>)}
            {c.delivery_destination === 'direct_job_site' && field('Job site address', <input className="form-input" style={{ fontSize: 13 }} defaultValue={c.job_site_address ?? ''} disabled={ro} onBlur={e => e.target.value !== (c.job_site_address ?? '') && patch({ job_site_address: e.target.value })} />)}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Documents ({docs.length})</div>
          {canEdit && !docForm.open && <button className="btn btn-ghost btn-sm" onClick={() => setDocForm(f => ({ ...f, open: true }))}><Plus size={13} /> Attach</button>}
        </div>
        <div className="card-body">
          {docForm.open && canEdit && (
            <div style={{ marginBottom: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12, display: 'grid', gridTemplateColumns: '1.6fr 1fr 2fr auto', gap: 8, alignItems: 'end' }}>
              {field('Name', <input className="form-input" style={{ fontSize: 13 }} value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BL-12345" />)}
              {field('Type', <select className="form-input" style={{ fontSize: 13 }} value={docForm.doc_type} onChange={e => setDocForm(f => ({ ...f, doc_type: e.target.value }))}>{DOC_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}</select>)}
              {field('Link (URL or Dropbox path)', <input className="form-input" style={{ fontSize: 13 }} value={docForm.url} onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" />)}
              <button className="btn btn-primary btn-sm" onClick={addDoc}>Save</button>
            </div>
          )}
          {docs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No documents attached.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {docs.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{d.name}</strong> <span className="pill" style={{ fontSize: 10, marginLeft: 6, textTransform: 'capitalize' }}>{cap(d.doc_type ?? 'other')}</span>
                    {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Open <ExternalLink size={11} /></a>}
                    {!d.url && d.dropbox_path && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>{d.dropbox_path}</span>}
                  </div>
                  {canEdit && <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: 'var(--status-danger)' }} onClick={() => removeDoc(d.id)} aria-label="Remove"><Trash2 size={13} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Loaded items ({items.length})</div>
          {canEdit && !adding && <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(true); searchAvailable(''); }}><Plus size={13} /> Load item</button>}
        </div>
        <div className="card-body">
          {adding && canEdit && (
            <div style={{ marginBottom: 14, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12 }}>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)' }} />
                <input className="form-input" style={{ paddingLeft: 30, fontSize: 13 }} placeholder="Search by PF code / type…" value={query} onChange={e => searchAvailable(e.target.value)} autoFocus />
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {avail.length === 0 ? <div style={{ fontSize: 12, color: 'var(--fg-faint)' }}>No available production items match.</div> : avail.map(a => (
                  <button key={a.id} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', border: '1px solid var(--border-subtle)', fontSize: 12 }} disabled={busy} onClick={() => loadItem(a)}>
                    <Plus size={11} /> <strong>{a.pf_code || a.type}</strong>&nbsp;· {a.type}{a.project_code ? ` · ${a.project_code}` : ''} · {cap(a.status.toLowerCase())}
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setAdding(false)}>Done</button>
            </div>
          )}
          {items.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No items loaded yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px' }}>PF / Type</th><th style={{ padding: '6px 8px' }}>Project</th>
                <th style={{ padding: '6px 8px' }}>Pkgs</th><th style={{ padding: '6px 8px' }}>Pallets</th><th style={{ padding: '6px 8px' }}>CBM</th><th></th>
              </tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px' }}><strong>{i.production_item?.pf_code || '—'}</strong> <span style={{ color: 'var(--fg-subtle)' }}>{i.production_item?.type}</span></td>
                    <td style={{ padding: '8px', color: 'var(--fg-subtle)' }}>{i.production_item?.project_code ?? '—'}</td>
                    <td style={{ padding: '8px' }}>{i.package_count ?? '—'}</td>
                    <td style={{ padding: '8px' }}>{i.pallet_count ?? '—'}</td>
                    <td style={{ padding: '8px' }}>{i.volume_cbm ?? '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{canEdit && <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: 'var(--status-danger)' }} onClick={() => unload(i.id)} aria-label="Unload"><Trash2 size={13} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
