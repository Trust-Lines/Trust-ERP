'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Ship } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { cn } from '@/lib/utils';
import { CONTAINER_STATUS_TAG, statusLabel } from '@/lib/status/tags';

export interface ContainerRow {
  id: string; container_no: string | null; booking_no: string | null; carrier: string | null;
  vessel_name: string | null; status: string; origin_port: string | null; destination_port: string | null;
  departure_date: string | null; estimated_arrival_date: string | null; actual_arrival_date: string | null;
  warehouse_arrival_date: string | null; item_count: number;
}

interface Props { initialContainers: ContainerRow[]; canEdit: boolean }

/** Platform status chip (lib/status/tags.ts "container" tone + icon), keeping the container's own label.
 *  `outlined` = the Figma table chip (node 394:74647): 36px, 1px tone border, 32px side padding. */
export function ContainerStatusBadge({ status, outlined }: { status: string; outlined?: boolean }) {
  return (
    <StatusBadge
      group="container" status={CONTAINER_STATUS_TAG[status] ?? status} label={statusLabel(status)}
      className={outlined ? 'h-9 gap-1.5 rounded-[4px] border border-current px-8 text-[12px] leading-4 [&_svg]:size-3.5' : undefined}
    />
  );
}

// Figma "Logistics — containers" (node 394:74525). The frame's search box and "Newest" sort
// have no backing feature here — the list is already newest first (page.tsx orders by created_at).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';

/** "2026-08-10" → "8/10/2026" without a timezone shifting the day. */
function usDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${Number(m)}/${Number(d)}/${y}` : iso;
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
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Operations', href: '/production' }, { label: 'Containers', href: '/logistics' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Containers</h1>
        <p className="m-0 text-[13px] text-ui-body">{containers.length} Active Container{containers.length !== 1 ? 's' : ''}</p>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="md" onClick={() => setShowForm(s => !s)} aria-expanded={showForm}
            className="gap-2 bg-ui-btn-accent px-8 text-[13px] font-medium text-ui-btn-accent-fg hover:bg-ui-btn-accent hover:opacity-90 dark:bg-ui-btn-accent dark:text-ui-btn-accent-fg dark:hover:bg-ui-btn-accent"
          >
            <Plus className="size-4" /> New Container
          </Button>
        </div>
      )}

      {showForm && canEdit && (
        <div className="card">
          <div className="card-head"><div className="form-section-title">New container</div></div>
          <div className="card-body"><ContainerForm onSave={create} onCancel={() => setShowForm(false)} /></div>
        </div>
      )}

      {containers.length === 0 ? (
        <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
          <EmptyState icon={<Ship />} title="No active containers." description={canEdit ? 'Create one to start loading production items.' : undefined} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-ui-surface">
                  <th className={cn(TH, 'w-[22%] pl-[18px]')}>Container</th>
                  <th className={cn(TH, 'w-[24%]')}>Route</th>
                  <th className={cn(TH, 'w-[22%]')}>ETA</th>
                  <th className={cn(TH, 'w-[17%]')}>Items</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {containers.map(c => {
                  const sub = [c.carrier, c.vessel_name].filter(Boolean).join(' · ') || (c.booking_no ? `Booking ${c.booking_no}` : '');
                  const eta = c.actual_arrival_date || c.estimated_arrival_date;
                  return (
                    <tr
                      key={c.id} onClick={() => router.push(`/logistics/${c.id}`)}
                      className="h-16 cursor-pointer border-b border-ui-divider last:border-b-0 hover:bg-ui-hover-bg/50"
                    >
                      <td className="max-w-0 py-0 pl-[18px] pr-2.5">
                        <Link href={`/logistics/${c.id}`} onClick={e => e.stopPropagation()} className={cn('block truncate text-[13px] font-semibold no-underline hover:underline', HEADING)}>
                          {c.container_no || '— no number —'}
                        </Link>
                        {sub && <p className="m-0 mt-1 truncate text-[11px] text-ui-body">{sub}</p>}
                      </td>
                      <td className="max-w-0 px-2.5"><p className="m-0 truncate text-[13px] text-ui-body">{[c.origin_port, c.destination_port].filter(Boolean).join(' → ') || '—'}</p></td>
                      <td className="px-2 text-[13px] whitespace-nowrap text-ui-body">{eta ? usDate(eta) : '—'}</td>
                      <td className="px-2 text-[13px] text-ui-body">{c.item_count}</td>
                      <td className="px-2"><ContainerStatusBadge status={c.status} outlined /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
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
        <Button onClick={submit} loading={saving}>Create container</Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}
