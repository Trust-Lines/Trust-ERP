'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { HEADING } from './designShared';
import { categoryLabel, priceLabel, type Material } from './library/MaterialsClient';

interface Line {
  id: string; area: string | null; quantity: number | null; note: string | null;
  material: Pick<Material, 'id' | 'category' | 'name' | 'code' | 'supplier_name' | 'finish' | 'color_hex' | 'unit' | 'price' | 'currency'> | null;
}

/** Design job panel → Materials: what this design specifies from the catalogue (Supply orders from it). */
export function JobMaterials({ jobId }: { jobId: string }) {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<Material[]>([]);
  const [pick, setPick] = useState<{ value: string; label: string } | null>(null);
  const [area, setArea] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/design-jobs/${jobId}/materials`).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not load the materials'); setLines([]); return; }
    setNotReady(b.notReady ?? null); setLines(b.lines ?? []);
  }, [jobId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch('/api/design/materials').then(r => r.json()).then(b => setCatalogue((b.materials ?? []).filter((m: Material) => m.is_active))).catch(() => {});
  }, []);

  const options = useMemo(() => catalogue.map(m => ({
    value: m.id, label: `${m.name}${m.code ? ` · ${m.code}` : ''} — ${categoryLabel(m.category)}${m.supplier_name ? ` · ${m.supplier_name}` : ''}`,
  })), [catalogue]);

  async function add() {
    if (!pick) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/materials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materialId: pick.value, area, quantity: qty, note }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not add'); return; }
      setPick(null); setArea(''); setQty(''); setNote('');
      void load();
    } finally { setBusy(false); }
  }

  async function remove(line: Line) {
    setLines(l => (l ?? []).filter(x => x.id !== line.id));
    const res = await fetch(`/api/design-jobs/${jobId}/materials?lineId=${line.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) { toast.error('Could not remove'); void load(); }
  }

  if (notReady) return <p className="m-0 text-[13px] text-ui-text-secondary">{notReady}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[12px] text-ui-text-secondary">
        The materials and finishes this design uses, picked from the <Link href="/design/materials" className="text-ui-link">catalogue</Link>. Supply orders from this list.
      </p>

      <div className="grid gap-2 rounded-[8px] bg-ui-surface p-4 sm:grid-cols-[1fr_160px_90px]">
        <Combobox aria-label="Material" placeholder={catalogue.length ? 'Search the catalogue…' : 'The catalogue is empty'} emptyText="No material matches"
          options={options} value={pick} onValueChange={setPick} />
        <Input aria-label="Area" value={area} onChange={e => setArea(e.target.value)} placeholder="Where (e.g. counter top)" />
        <Input aria-label="Quantity" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty" />
        <Input aria-label="Note" className="sm:col-span-2" value={note} onChange={e => setNote(e.target.value)} placeholder="Note (edge band, grain direction…)" />
        <Button size="sm" onClick={() => void add()} disabled={!pick || busy}><Plus /> Add</Button>
      </div>

      {lines === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : lines.length === 0 ? (
        <div className="rounded-[8px] bg-ui-surface p-4"><EmptyState size="sm" icon={<Layers />} title="No materials specified yet." /></div>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-ui-divider rounded-[8px] bg-ui-surface p-0">
          {lines.map(l => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <span aria-hidden className="size-8 shrink-0 rounded-[4px] border border-ui-divider" style={{ background: l.material?.color_hex ?? 'var(--ui-surface-elevated)' }} />
              <div className="min-w-0 flex-1">
                <p className={cn('m-0 truncate text-[13px] font-medium', HEADING)}>{l.material?.name ?? 'Removed material'}{l.material?.code ? ` · ${l.material.code}` : ''}</p>
                <p className="m-0 truncate text-[11px] text-ui-text-secondary">
                  {[l.area, l.material ? categoryLabel(l.material.category) : null, l.material?.supplier_name, l.material?.finish, l.note].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="w-[70px] text-right text-[12px] text-ui-body">{l.quantity != null ? `${l.quantity}${l.material?.unit ? ` ${l.material.unit}` : ''}` : '—'}</span>
              <span className="w-[110px] text-right text-[12px] text-ui-text-secondary">{l.material ? priceLabel(l.material) : '—'}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => void remove(l)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
