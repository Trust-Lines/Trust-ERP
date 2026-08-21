'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ship } from 'lucide-react';
import { toast } from 'sonner';
import { Pill } from '@/components/platform/shared/Pill';

export interface ContainerRow {
  id: string; container_no: string | null; booking_no: string | null; carrier: string | null;
  vessel_name: string | null; status: string; origin_port: string | null; destination_port: string | null;
  departure_date: string | null; estimated_arrival_date: string | null; actual_arrival_date: string | null;
  warehouse_arrival_date: string | null; item_count: number;
}

interface Props { initialContainers: ContainerRow[]; canEdit: boolean }

const STATUS_VARIANT: Record<string, 'neutral' | 'warning' | 'info' | 'success'> = {
  PLANNING: 'neutral', BOOKED: 'neutral', WAITING_LOADING: 'warning', LOADING: 'warning',
  DEPARTED: 'info', IN_TRANSIT: 'info', ARRIVED_PORT: 'info', CUSTOMS: 'warning', RELEASED: 'info',
  WAREHOUSE: 'success', COMPLETED: 'success', CANCELLED: 'neutral',
};
const cap = (s: string) => s.replace(/_/g, ' ');

function StatusPill({ status }: { status: string }) {
  return <Pill variant={STATUS_VARIANT[status] ?? 'neutral'}><span style={{ textTransform: 'capitalize' }}>{cap(status.toLowerCase())}</span></Pill>;
}

export function LogisticsClient({ initialContainers, canEdit }: Props) {
  const router = useRouter();
  const [containers, setContainers] = useState<ContainerRow[]>(initialContainers);
  const [showForm, setShowForm] = useState(false);

  async function create(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch('/api/containers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Failed'); return false; }
    setContainers(p => [b.container, ...p]);
    setShowForm(false);
    toast.success('Container created');
    router.push(`/logistics/${b.container.id}`);
    return true;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}><Ship size={20} /> Containers</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{containers.length} active container{containers.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>+ New container</button>}
      </div>

      {showForm && canEdit && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><div className="form-section-title">New container</div></div>
          <div className="card-body"><ContainerForm onSave={create} onCancel={() => setShowForm(false)} /></div>
        </div>
      )}

      {containers.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <Ship size={28} style={{ opacity: 0.4, marginBottom: 8 }} /><div>No active containers.{canEdit && ' Create one to start loading production items.'}</div>
        </div></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              <th style={{ padding: '10px 14px' }}>Container</th><th style={{ padding: '10px 14px' }}>Route</th>
              <th style={{ padding: '10px 14px' }}>ETA</th><th style={{ padding: '10px 14px' }}>Items</th><th style={{ padding: '10px 14px' }}>Status</th>
            </tr></thead>
            <tbody>
              {containers.map(c => (
                <tr key={c.id} onClick={() => router.push(`/logistics/${c.id}`)} style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{c.container_no || '— no number —'}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{[c.carrier, c.vessel_name].filter(Boolean).join(' · ') || (c.booking_no ? `Booking ${c.booking_no}` : '')}</div>
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--fg-subtle)' }}>{[c.origin_port, c.destination_port].filter(Boolean).join(' → ') || '—'}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--fg-subtle)' }}>{c.actual_arrival_date || c.estimated_arrival_date || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>{c.item_count}</td>
                  <td style={{ padding: '11px 14px' }}><StatusPill status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ContainerForm({ onSave, onCancel }: { onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [f, setF] = useState({ container_no: '', booking_no: '', carrier: '', vessel_name: '', origin_port: '', destination_port: '', estimated_arrival_date: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  async function submit() { setSaving(true); await onSave(f); setSaving(false); }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Container #</label><input className="form-input" placeholder="MSKU1234567" value={f.container_no} onChange={set('container_no')} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Booking #</label><input className="form-input" value={f.booking_no} onChange={set('booking_no')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Carrier</label><input className="form-input" value={f.carrier} onChange={set('carrier')} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 150px', gap: 10, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Vessel</label><input className="form-input" value={f.vessel_name} onChange={set('vessel_name')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Origin port</label><input className="form-input" value={f.origin_port} onChange={set('origin_port')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Destination port</label><input className="form-input" value={f.destination_port} onChange={set('destination_port')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>ETA</label><input type="date" className="form-input" value={f.estimated_arrival_date} onChange={set('estimated_arrival_date')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create container'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
