'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { MATERIAL_CATEGORIES, normalizeHex } from '@/lib/design/libraryPaths';
import { openFetchedLink, uploadViaLink } from '@/lib/client/designUpload';
import { HEADING } from '../designShared';
import { LibraryHeader, NotReady } from './LibraryShell';

export interface Material {
  id: string; category: string; name: string; code: string | null; supplier_id: string | null; supplier_name: string | null;
  finish: string | null; color_hex: string | null; unit: string | null; price: number | null; currency: string;
  image_path: string | null; notes: string | null; is_active: boolean; created_by: string | null;
}
const API = '/api/design/materials';
export const categoryLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
export const priceLabel = (m: Pick<Material, 'price' | 'currency' | 'unit'>) =>
  m.price == null ? '—' : `${new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency || 'USD' }).format(Number(m.price))}${m.unit ? ` / ${m.unit}` : ''}`;

export function MaterialsClient() {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [me, setMe] = useState(''); const [isManager, setIsManager] = useState(false);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Material | 'new' | null>(null);
  const [removing, setRemoving] = useState<Material | null>(null);

  async function load() {
    const res = await fetch(API).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not load materials'); setMaterials([]); return; }
    setNotReady(b.notReady ?? null); setMaterials(b.materials ?? []); setMe(b.me ?? ''); setIsManager(!!b.isManager);
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (materials ?? []).filter(m => (showInactive || m.is_active) && (!category || m.category === category)
      && (!s || `${m.name} ${m.code ?? ''} ${m.supplier_name ?? ''} ${m.finish ?? ''}`.toLowerCase().includes(s)));
  }, [materials, category, q, showInactive]);

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      <LibraryHeader crumb="Design / Materials & Finishes" title="Materials & Finishes"
        subtitle="The catalogue designers specify from: laminates, paints, woods, metals… with the supplier code and price. A design job lists the materials it uses, so Supply knows what to order."
        action={<Button onClick={() => setEditing('new')} disabled={!!notReady}><Plus /> Add material</Button>} />
      {notReady && <NotReady message={notReady} />}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-[285px] max-w-full">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
          <input type="search" aria-label="Search materials" placeholder="Search name, code, supplier…" value={q} onChange={e => setQ(e.target.value)}
            className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring" />
        </div>
        <Select aria-label="Category" className="h-9 w-[170px]" value={category} onValueChange={v => setCategory(v ?? '')}
          options={[{ value: '', label: 'All categories' }, ...MATERIAL_CATEGORIES.map(c => ({ value: c, label: categoryLabel(c) }))]} />
        <button type="button" aria-pressed={showInactive} onClick={() => setShowInactive(s => !s)}
          className="h-9 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-body aria-pressed:bg-ui-selected-bg">
          {showInactive ? 'Hide discontinued' : 'Show discontinued'}
        </button>
      </div>

      {materials === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : visible.length === 0 ? (
        <div className="rounded-[8px] bg-ui-surface p-5">
          <EmptyState icon={<Layers />} title={materials.length ? 'No matching materials' : 'The catalogue is empty'}
            description={materials.length ? 'Try another search or category.' : 'Add the materials and finishes you specify most.'} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] bg-ui-surface">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-ui-text-secondary">
                {['', 'Material', 'Category', 'Code', 'Supplier', 'Finish', 'Price', ''].map((h, i) => <th key={i} className="border-b border-ui-divider px-3 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map(m => {
                const editable = isManager || m.created_by === me;
                return (
                  <tr key={m.id} className={cn('border-b border-ui-divider last:border-0', !m.is_active && 'opacity-60')}>
                    <td className="w-[52px] px-3 py-2">
                      <span aria-hidden className="block size-8 rounded-[4px] border border-ui-divider" style={{ background: m.color_hex ?? 'var(--ui-surface-elevated)' }} />
                    </td>
                    <td className="px-3 py-2"><span className={cn('font-medium', HEADING)}>{m.name}</span>{!m.is_active && <span className="ml-2 text-[11px] text-ui-text-secondary">discontinued</span>}{m.notes && <p className="m-0 line-clamp-1 text-[11px] text-ui-text-secondary">{m.notes}</p>}</td>
                    <td className="px-3 py-2">{categoryLabel(m.category)}</td>
                    <td className="px-3 py-2 font-mono text-[12px]">{m.code ?? '—'}</td>
                    <td className="px-3 py-2">{m.supplier_name ?? '—'}</td>
                    <td className="px-3 py-2">{m.finish ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{priceLabel(m)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {m.image_path && <Button variant="ghost" size="icon-sm" aria-label={`Photo of ${m.name}`} onClick={() => void openFetchedLink(async () => {
                          const res = await fetch(`${API}/${m.id}`, { method: 'POST' }); const b = await res.json().catch(() => ({}));
                          if (!res.ok) { toast.error(b.error ?? 'Could not open'); return null; } return b.link;
                        })}><ImageIcon /></Button>}
                        {editable && <Button variant="ghost" size="icon-sm" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}><Pencil /></Button>}
                        {editable && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name}`} onClick={() => setRemoving(m)}><Trash2 /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <MaterialEditor material={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
      <ConfirmModal open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive"
        title={`Remove “${removing?.name}”?`} description="It leaves the catalogue. Jobs that already use it keep their line." confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          const res = await fetch(`${API}/${removing.id}`, { method: 'DELETE' }); const b = await res.json().catch(() => ({}));
          if (!res.ok) toast.error(b.error ?? 'Could not remove'); else { toast.success('Material removed'); void load(); }
          setRemoving(null);
        }} />
    </div>
  );
}

function MaterialEditor({ material, onClose, onSaved }: { material: Material | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: material?.name ?? '', category: material?.category ?? 'laminate', code: material?.code ?? '',
    supplier_id: material?.supplier_id ?? '', supplier_name: material?.supplier_name ?? '', finish: material?.finish ?? '',
    color_hex: material?.color_hex ?? '', unit: material?.unit ?? '', price: material?.price != null ? String(material.price) : '',
    currency: material?.currency ?? 'USD', notes: material?.notes ?? '', is_active: material?.is_active ?? true,
    image_path: material?.image_path ?? '',
  });
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    fetch(`${API}?suppliers=1`).then(r => r.json()).then(b => setSuppliers(b.suppliers ?? [])).catch(() => {});
  }, []);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try { set('image_path', await uploadViaLink(API, file)); toast.success('Photo uploaded'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not upload the photo'); }
    finally { setUploading(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const supplierName = f.supplier_id ? suppliers.find(s => s.id === f.supplier_id)?.name ?? f.supplier_name : f.supplier_name;
      const res = await fetch(material ? `${API}/${material.id}` : API, {
        method: material ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, supplier_name: supplierName }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      toast.success(material ? 'Material saved' : 'Material added'); onSaved();
    } finally { setSaving(false); }
  }

  const field = 'flex flex-col gap-1 text-[12px] font-medium';
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent size="lg" title={material ? `Edit ${material.name}` : 'Add material'}
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose><Button loading={saving} disabled={uploading} onClick={() => void save()}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <label className={cn(field, 'col-span-2')}>Name<Input value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Egger H3303 Hamilton Oak" /></label>
          <label className={field}>Category
            <Select aria-label="Category" value={f.category} onValueChange={v => set('category', v ?? 'other')} options={MATERIAL_CATEGORIES.map(c => ({ value: c, label: categoryLabel(c) }))} />
          </label>
          <label className={field}>Code<Input value={f.code} onChange={e => set('code', e.target.value)} placeholder="Supplier / manufacturer code" /></label>
          <label className={field}>Supplier
            <Select aria-label="Supplier" value={f.supplier_id} onValueChange={v => set('supplier_id', v ?? '')}
              options={[{ value: '', label: 'Other (type below)' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />
          </label>
          <label className={field}>Supplier name{f.supplier_id ? <Input value={suppliers.find(s => s.id === f.supplier_id)?.name ?? ''} disabled /> : <Input value={f.supplier_name} onChange={e => set('supplier_name', e.target.value)} placeholder="If not in Suppliers" />}</label>
          <label className={field}>Finish<Input value={f.finish} onChange={e => set('finish', e.target.value)} placeholder="Matte, gloss, brushed…" /></label>
          <div className={field}>Colour
            <div className="flex gap-2">
              <input type="color" aria-label="Pick a colour" value={normalizeHex(f.color_hex) ?? '#cccccc'} onChange={e => set('color_hex', e.target.value)} className="h-8 w-10 cursor-pointer rounded-[4px] border border-ui-divider bg-transparent p-0.5" />
              <Input value={f.color_hex} onChange={e => set('color_hex', e.target.value)} placeholder="#C9B79C" />
            </div>
          </div>
          <label className={field}>Price<Input inputMode="decimal" value={f.price} onChange={e => set('price', e.target.value)} placeholder="0.00" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className={field}>Currency<Input value={f.currency} maxLength={3} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
            <label className={field}>Unit<Input value={f.unit} onChange={e => set('unit', e.target.value)} placeholder="sheet, m², L" /></label>
          </div>
          <label className={cn(field, 'col-span-2')}>Notes<Textarea rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Lead time, minimum order, where it's used…" /></label>
          <div className="col-span-2 flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}><Camera /> {f.image_path ? 'Replace photo' : 'Add photo'}</Button>
            {f.image_path && <span className="truncate text-[12px] text-ui-text-secondary">{f.image_path.split('/').pop()}</span>}
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void uploadPhoto(file); }} />
            <label className="ml-auto flex items-center gap-2 text-[12px]"><Checkbox checked={f.is_active} onCheckedChange={c => set('is_active', !!c)} /> Available (uncheck when discontinued)</label>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
