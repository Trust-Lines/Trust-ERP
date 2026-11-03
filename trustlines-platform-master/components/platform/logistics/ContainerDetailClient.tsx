'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Search, ExternalLink, Package, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { CONTAINER_STATUSES } from '@/lib/logistics/containers';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ContainerStatusBadge } from './LogisticsClient';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PRODUCTION_ITEM_STATUS_TAG, statusLabel } from '@/lib/status/tags';
import { cn } from '@/lib/utils';

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

const DOC_TYPES = ['bill_of_lading', 'packing_list', 'customs', 'invoice', 'other'];

// Figma "Container detail" (node 427:3360). The frame's Delete / Save changes buttons, file
// upload drop zone + queue, "Remaining" count and Loaded Date column have no backing feature
// here: fields still save on blur/change, documents are still attached as links.
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'rounded-[8px] border border-ui-divider bg-ui-page-bg';
const SURFACE = 'rounded-[8px] border border-ui-divider p-6';
const LABEL = 'text-[12px] font-medium leading-4 text-ui-body';
const INPUT = 'h-[42px] w-full min-w-0 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[14px] leading-[1.4] text-ui-body outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:cursor-not-allowed disabled:opacity-60';
const SELECT = 'h-[42px] w-full rounded-[6px] text-[14px]';
const COUNT = 'inline-flex items-center rounded-[4px] bg-[var(--color-secondary-700)] px-2 py-px text-[16px] font-semibold leading-[1.5] text-white dark:bg-primary-50 dark:text-primary-950';
const ACCENT_BTN = 'gap-2 bg-ui-btn-accent pl-3 pr-5 text-[13px] font-medium text-ui-btn-accent-fg hover:bg-ui-btn-accent hover:opacity-90 dark:bg-ui-btn-accent dark:text-ui-btn-accent-fg dark:hover:bg-ui-btn-accent';

const field = (label: string, node: React.ReactNode, className?: string) => (
  <label className={cn('flex min-w-0 flex-col gap-[7px]', className)}><span className={LABEL}>{label}</span>{node}</label>
);

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <span className={cn('truncate text-[14px] font-medium leading-[1.5]', HEADING)}>{value || '-'}</span>
    </div>
  );
}

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

  async function patch(p: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/containers/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return false; }
      setC(b.container);
      return true;
    } finally { setBusy(false); }
  }

  // Date inputs are uncontrolled: put the saved value back when the server rejects a date.
  const patchDate = (key: 'departure_date' | 'estimated_arrival_date' | 'actual_arrival_date') =>
    async (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const ok = await patch({ [key]: input.value || null });
      if (!ok) input.value = c[key] ?? '';
    };

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
  const title = c.container_no || 'Container';
  const route = [c.origin_port, c.destination_port].filter(Boolean).join(' → ');
  // Uncontrolled text field that saves on blur when the value changed.
  const text = (key: 'carrier' | 'vessel_name' | 'voyage_no' | 'origin_port' | 'destination_port' | 'seal_no' | 'booking_no' | 'job_site_address') => (
    <input className={INPUT} defaultValue={c[key] ?? ''} disabled={ro} onBlur={e => e.target.value !== (c[key] ?? '') && patch({ [key]: e.target.value })} />
  );

  return (
    <div className="flex flex-col gap-6">
      <Link href="/logistics" className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-fit no-underline' })}>
        <ArrowLeft /> All containers
      </Link>

      {/* ── Page heading ── */}
      <div className="flex flex-wrap items-center gap-5">
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>{title}</h1>
        <ContainerStatusBadge status={c.status} outlined />
        {c.tracking_url && (
          <a href={c.tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-ui-link">
            Track <ExternalLink size={12} aria-hidden />
          </a>
        )}
      </div>

      {/* ── Shipment + summary ── */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        <section className={cn(CARD, 'flex min-w-0 flex-1 flex-col gap-[26px] px-5 pb-5 pt-4')}>
          <h2 className={cn('m-0 text-[24px] font-semibold leading-[1.35]', HEADING)}>Shipment</h2>
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {field('Status', (
                <Select
                  aria-label="Status" className={cn(SELECT, 'p-1 pr-3')} value={c.status} disabled={ro}
                  onValueChange={v => v && v !== c.status && void patch({ status: v })}
                  options={CONTAINER_STATUSES.map(s => ({ value: s, label: statusLabel(s) }))}
                  renderOption={o => <ContainerStatusBadge status={o.value} />}
                />
              ))}
              {field('Carrier', text('carrier'))}
              {field('Vessel', text('vessel_name'))}
              {field('Voyage', text('voyage_no'))}
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {field('Origin Port', text('origin_port'))}
              {field('Destination Port', text('destination_port'))}
              {field('Seal #', text('seal_no'))}
              {field('Booking #', text('booking_no'))}
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {field('Departure', <input type="date" className={INPUT} defaultValue={c.departure_date ?? ''} max={c.estimated_arrival_date ?? undefined} disabled={ro} onChange={patchDate('departure_date')} />)}
              {field('ETA', <input type="date" className={INPUT} defaultValue={c.estimated_arrival_date ?? ''} min={c.departure_date ?? undefined} disabled={ro} onChange={patchDate('estimated_arrival_date')} />)}
              {field('Arrived', <input type="date" className={INPUT} defaultValue={c.actual_arrival_date ?? ''} min={c.departure_date ?? undefined} disabled={ro} onChange={patchDate('actual_arrival_date')} />)}
              {/* customs_clearance_date: migration 058, in the PATCH EDITABLE list (Roadmap Month 3, task 19). */}
              {field('Customs Cleared', <input type="date" className={INPUT} defaultValue={c.customs_clearance_date ?? ''} disabled={ro} onChange={e => patch({ customs_clearance_date: e.target.value || null })} />)}
              {field('Warehouse', <input type="date" className={INPUT} defaultValue={c.warehouse_arrival_date ?? ''} disabled={ro} onChange={e => patch({ warehouse_arrival_date: e.target.value || null })} />)}
            </div>
            <div className="flex flex-col gap-4 md:flex-row">
              {field('Delivery Destination', (
                <Select
                  aria-label="Delivery destination" className={cn(SELECT, 'font-medium')} value={c.delivery_destination} disabled={ro}
                  onValueChange={v => v && v !== c.delivery_destination && void patch({ delivery_destination: v })}
                  options={[{ value: 'warehouse', label: 'Warehouse' }, { value: 'direct_job_site', label: 'Direct to job site' }]}
                />
              ), 'md:w-[229px] md:shrink-0')}
              {c.delivery_destination === 'direct_job_site' && field('Job site address', text('job_site_address'), 'flex-1')}
            </div>
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-[26px] rounded-[8px] border border-ui-divider bg-ui-surface p-5 xl:w-[365px]">
          <div className="flex flex-col gap-1">
            <p className={cn('m-0 truncate text-[20px] font-semibold leading-[1.45]', HEADING)}>{title}</p>
            <ContainerStatusBadge status={c.status} />
          </div>
          <SummaryRow label="Carrier" value={c.carrier} />
          <SummaryRow label="Vessel" value={c.vessel_name} />
          <SummaryRow label="Voyage" value={c.voyage_no} />
          <SummaryRow label="Route" value={route} />
          <SummaryRow label="Items #" value={String(items.length)} />
        </aside>
      </div>

      {/* ── Documents + loaded items ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <section className={cn(CARD, 'flex flex-col gap-4 p-[15px]')}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className={cn('m-0 text-[24px] font-semibold leading-[1.35]', HEADING)}>Documents</h2>
              <span className={COUNT}>{docs.length}</span>
            </div>
            {canEdit && !docForm.open && <Button variant="secondary" onClick={() => setDocForm(f => ({ ...f, open: true }))}><Plus /> Attach</Button>}
          </div>
          <div className={cn(SURFACE, 'flex flex-col gap-4')}>
            {docForm.open && canEdit && (
              // Half-width card: Name + Type on one row, the link full width, buttons under it.
              <div className="grid grid-cols-1 gap-3 rounded-[6px] border border-ui-divider bg-ui-surface p-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                {field('Name', <input className={INPUT} value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BL-12345" />)}
                {field('Type', (
                  <Select aria-label="Type" className={SELECT} value={docForm.doc_type} onValueChange={v => setDocForm(f => ({ ...f, doc_type: v ?? 'other' }))}
                    options={DOC_TYPES.map(t => ({ value: t, label: statusLabel(t) }))} />
                ))}
                {field('Link (URL or Dropbox path)', <input className={INPUT} value={docForm.url} onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" />, 'sm:col-span-2')}
                <div className="flex gap-2 sm:col-span-2">
                  <Button size="md" onClick={addDoc}>Save</Button>
                  <Button size="md" variant="ghost" onClick={() => setDocForm(f => ({ ...f, open: false }))}>Cancel</Button>
                </div>
              </div>
            )}
            {docs.length === 0 ? (
              <EmptyState size="sm" icon={<FileText />} title="No documents attached." />
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {docs.map(d => (
                  <li key={d.id} className="flex items-center gap-3 border-b border-ui-divider py-3 first:pt-0 last:border-b-0 last:pb-0">
                    <FileText size={22} aria-hidden className="shrink-0 text-ui-text-secondary" />
                    <div className="min-w-0 flex-1">
                      <p className={cn('m-0 truncate text-[13px] font-medium leading-[1.45]', HEADING)}>{d.name}</p>
                      <p className="m-0 truncate text-[12px] text-ui-text-secondary">
                        {statusLabel(d.doc_type ?? 'other')}
                        {!d.url && d.dropbox_path && <span className="font-mono"> · {d.dropbox_path}</span>}
                      </p>
                    </div>
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[12px] text-ui-link">
                        Open <ExternalLink size={11} aria-hidden />
                      </a>
                    )}
                    {canEdit && <Button variant="ghost" size="icon" className="text-error-normal" onClick={() => removeDoc(d.id)} title="Remove document" aria-label="Remove document"><Trash2 className="size-4" /></Button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={cn(CARD, 'flex flex-col gap-4 p-[15px]')}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className={cn('m-0 text-[24px] font-semibold leading-[1.35]', HEADING)}>Loaded Items</h2>
              <span className={COUNT}>{items.length}</span>
            </div>
            {canEdit && !adding && (
              <Button className={ACCENT_BTN} onClick={() => { setAdding(true); searchAvailable(''); }}><Plus className="size-4" /> Load Item</Button>
            )}
          </div>
          <div className={cn(SURFACE, 'flex flex-col gap-4')}>
            {adding && canEdit && (
              <div className="rounded-[6px] border border-ui-divider bg-ui-surface p-3">
                <div className="relative mb-2">
                  <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
                  <input className={cn(INPUT, 'pl-8 text-[13px]')} placeholder="Search by PF code / type…" value={query} onChange={e => searchAvailable(e.target.value)} autoFocus />
                </div>
                <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
                  {avail.length === 0 ? <p className="m-0 text-[12px] text-ui-text-secondary">No available production items match.</p> : avail.map(a => (
                    <Button key={a.id} variant="ghost" className="w-full justify-start border-ui-divider font-normal" disabled={busy} onClick={() => loadItem(a)}>
                      <Plus /> <strong className="font-semibold">{a.pf_code || a.type}</strong>· {a.type}{a.project_code ? ` · ${a.project_code}` : ''}
                      <StatusBadge group="production" status={PRODUCTION_ITEM_STATUS_TAG[a.status] ?? a.status} label={statusLabel(a.status)} size="sm" className="ml-auto" />
                    </Button>
                  ))}
                </div>
                <Button variant="secondary" className="mt-2" onClick={() => setAdding(false)}>Done</Button>
              </div>
            )}
            {items.length === 0 ? (
              <EmptyState size="sm" icon={<Package />} title="No items loaded yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr className="border-b border-ui-divider text-left text-[13px] font-normal leading-[1.45] text-ui-text-secondary">
                      <th className="pb-2 pr-3 font-normal">Item #</th>
                      <th className="pb-2 pr-3 font-normal">Item Name</th>
                      <th className="pb-2 pr-3 font-normal">Project</th>
                      <th className="pb-2 pr-3 text-right text-[12px] font-normal">Pkgs</th>
                      <th className="pb-2 pr-3 text-right text-[12px] font-normal">Pallets</th>
                      <th className="pb-2 pr-3 text-right text-[12px] font-normal">CBM</th>
                      {canEdit && <th className="w-8 pb-2"><span className="sr-only">Actions</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.id} className={cn('border-b border-ui-divider text-[13px] font-medium leading-[1.45] last:border-b-0', HEADING)}>
                        <td className="py-1 pr-3">{i.production_item?.pf_code || '—'}</td>
                        <td className="py-1 pr-3">{i.production_item?.type ?? '—'}</td>
                        <td className="py-1 pr-3 font-normal text-ui-text-secondary">{i.production_item?.project_code ?? '—'}</td>
                        <td className="py-1 pr-3 text-right text-[12px] font-normal text-ui-text-secondary">{i.package_count ?? '—'}</td>
                        <td className="py-1 pr-3 text-right text-[12px] font-normal text-ui-text-secondary">{i.pallet_count ?? '—'}</td>
                        <td className="py-1 pr-3 text-right text-[12px] font-normal text-ui-text-secondary">{i.volume_cbm ?? '—'}</td>
                        {canEdit && (
                          <td className="py-1 text-right">
                            <Button variant="ghost" size="icon-sm" className="text-error-normal" onClick={() => unload(i.id)} title="Unload item" aria-label="Unload item"><Trash2 className="size-4" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
