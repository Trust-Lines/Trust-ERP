'use client';

import Image from 'next/image';
import { useEffect, useState, type ComponentType, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Cpu, ExternalLink, Gpu, HardDrive, ImagePlus, MemoryStick, Plus, Printer, QrCode, SquarePen } from 'lucide-react';
import { Modal, ModalContent } from '@/components/ui/modal';
import {
  COMPUTER_CATEGORIES,
  ITEM_CATEGORIES,
  IT_IMAGE_TYPES,
  IT_FILE_MAX_BYTES,
  IT_LOCATIONS,
  SPEC_KEYS,
  SPEC_LABEL,
  type ItemCategory,
  type ItemStatus,
  type SpecKey,
} from '@/lib/it/constants';
import { cn } from '@/lib/utils';
import { CATEGORY_LABEL, STRONG } from './itemStyles';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useItemQr } from './itemQr';
import { FORM_FIELD, FORM_PANEL, FORM_TEXTAREA, LABEL, PANEL_TITLE, PRIMARY_BTN, SECONDARY_BTN } from './itFormParts';
import { LabelSheetDialog } from './LabelSheetDialog';

// Items Library → Add Item and Item → Edit Info, laid out like the item page (Figma 845:42033):
// a Basic Info panel (photo + fields) and, for computers, Specifications cards.
//
// Adding offers two ways:
//   • Fill in now — the whole form, then the item's QR label to print.
//   • Quick add + QR — only the category (name / office optional): the item is created at once and
//     its QR label shown to print and stick on the device. Scanning the label later opens the
//     item's page, which opens this form while the item has no details yet — filled from a phone.

export interface ItItemFormValues {
  id?: string;
  name: string;
  model: string;
  category: ItemCategory;
  location: string;
  status: ItemStatus;
  assigneeId: string;
  setLabel: string;
  notes: string;
  specs: Record<string, string>;
  remoteAddress: string;
  /** Phones: the line's number — added to (or linked in) Phone Numbers. */
  phoneNumber: string;
}

export const EMPTY_ITEM: ItItemFormValues = {
  name: '', model: '', category: 'pc', location: '', status: 'available', assigneeId: '',
  setLabel: '', notes: '', specs: {}, remoteAddress: '', phoneNumber: '',
};

// Panels, fields and buttons come from the shared IT form system (itFormParts).
export { LABEL, PRIMARY_BTN, SECONDARY_BTN };
const PANEL = FORM_PANEL;
const FIELD = FORM_FIELD;

const STATUS_LABEL: Record<ItemStatus, string> = { available: 'Available', repair: 'Repair', assigned: 'Assigned to a person' };
const CATEGORY_OPTIONS = ITEM_CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABEL[c] }));
const LOCATION_OPTIONS = [{ value: '', label: '—' }, ...IT_LOCATIONS.map(l => ({ value: l, label: l }))];
const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as ItemStatus[]).map(s => ({ value: s, label: STATUS_LABEL[s] }));
const SPEC_ICON: Record<SpecKey, ComponentType<{ className?: string; strokeWidth?: number }>> = { cpu: Cpu, gpu: Gpu, ram: MemoryStick, storage: HardDrive };

async function errorOf(res: Response) {
  const j = await res.json().catch(() => null) as { error?: string } | null;
  return j?.error ?? `Request failed (${res.status})`;
}

/** After adding: the new item's QR label — print it, open the item, or add another. */
function CreatedLabel({ id, name, detail, onOpen, onAnother, onClose }: { id: string; name: string; detail: string; onOpen: () => void; onAnother: () => void; onClose: () => void }) {
  const { url, qr } = useItemQr(id);
  const [printing, setPrinting] = useState(false);
  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <p className="m-0 text-[14px] text-ui-body"><b className={STRONG}>{name}</b> is in the library. Print the label and stick it on the device — scanning it opens the item, ready to fill in from a phone.</p>
      <div className="rounded-[11px] bg-white p-2.5 shadow-sm">
        {qr ? <Image src={qr} alt={`QR code for ${name}`} width={223} height={223} unoptimized className="size-[223px]" />
          : <div className="grid size-[223px] place-items-center text-[13px] text-ui-text-secondary">Making the QR code…</div>}
      </div>
      {url && <p className="m-0 max-w-full break-all rounded-md bg-ui-surface px-3 py-2 text-[13px] text-ui-body">{url}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={PRIMARY_BTN} disabled={!qr || !url} onClick={() => setPrinting(true)}><Printer size={16} aria-hidden /> Print</button>
        <button type="button" className={SECONDARY_BTN} onClick={onOpen}><ExternalLink size={16} aria-hidden /> Open item</button>
        <button type="button" className={SECONDARY_BTN} onClick={onAnother}><Plus size={16} aria-hidden /> Add another</button>
        <button type="button" className={SECONDARY_BTN} onClick={onClose}>Done</button>
      </div>
      {printing && <LabelSheetDialog items={[{ id, name, detail }]} onClose={() => setPrinting(false)} />}
    </div>
  );
}

export function ItItemFormDialog({ initial, assignees, onClose, onSaved, onCreated }: {
  initial: ItItemFormValues;
  assignees: { id: string; name: string }[];
  onClose: () => void;
  /** Edit: saved. Add: "Open item" on the label screen. */
  onSaved: (id: string) => void;
  /** Add: the item was created (refresh the list). */
  onCreated?: (id: string) => void;
}) {
  const [f, setF] = useState<ItItemFormValues>(initial);
  const [mode, setMode] = useState<'full' | 'quick'>('full');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const editing = !!initial.id;
  const quick = !editing && mode === 'quick';
  const computer = COMPUTER_CATEGORIES.includes(f.category);
  const set = <K extends keyof ItItemFormValues>(k: K, v: ItItemFormValues[K]) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!quick && f.status === 'assigned' && !f.assigneeId) { toast.error('Choose who holds this item'); return; }
    if (photo && (!IT_IMAGE_TYPES[photo.type] || photo.size > IT_FILE_MAX_BYTES)) { toast.error('The photo must be a JPG, PNG or WebP under 4 MB'); return; }
    // Quick add: only what's needed to label the device; everything else is filled in later.
    const name = f.name.trim() || `New ${CATEGORY_LABEL[f.category]}`;
    const body = quick
      ? { ...EMPTY_ITEM, category: f.category, location: f.location, name }
      : { ...f, name, assigneeId: f.status === 'assigned' ? f.assigneeId : null };
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/it/items/${initial.id}` : '/api/it/items', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      const id = editing ? initial.id! : ((await res.json()) as { item: { id: string } }).item.id;
      if (photo && !quick) {
        const fd = new FormData();
        fd.append('file', photo);
        const up = await fetch(`/api/it/items/${id}/image`, { method: 'POST', body: fd });
        if (!up.ok) toast.error(`Saved, but the photo failed: ${await errorOf(up)}`);
      }
      if (editing) { toast.success('Item updated'); onSaved(id); return; }
      toast.success('Item added');
      setCreated({ id, name });
      onCreated?.(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the item');
    } finally {
      setSaving(false);
    }
  }

  const title = created ? 'Item added — QR label' : editing ? 'Edit Item' : 'Add Item';
  return (
    <Modal open onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <ModalContent size={created || quick ? 'lg' : 'xl'} title={title} description={created ? undefined : 'IT equipment in the Items Library.'}>
        {created ? (
          <CreatedLabel id={created.id} name={created.name} detail={[CATEGORY_LABEL[f.category], f.location.trim()].filter(Boolean).join(' · ')} onClose={onClose} onOpen={() => onSaved(created.id)}
            onAnother={() => { setCreated(null); setF({ ...EMPTY_ITEM, category: f.category, location: f.location }); setPhoto(null); }} />
        ) : (
          <form onSubmit={submit} className="flex max-h-[72vh] flex-col gap-5 overflow-y-auto pr-1">
            {!editing && (
              <div role="radiogroup" aria-label="How to add" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  ['full', SquarePen, 'Fill in now', 'Every detail now, then print the QR label.'],
                  ['quick', QrCode, 'Quick add + QR', 'Just the category — print the QR, fill it in later from a phone.'],
                ] as const).map(([key, Icon, label, hint]) => (
                  <button key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => setMode(key)}
                    className={cn('flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                      mode === key ? 'border-secondary-700 bg-ui-selected-bg dark:border-secondary-50' : 'border-ui-divider hover:bg-ui-hover-bg')}>
                    <Icon size={20} aria-hidden className={cn('mt-0.5 shrink-0', STRONG)} />
                    <span className="flex flex-col gap-0.5">
                      <span className={cn('text-[14px] font-semibold', STRONG)}>{label}</span>
                      <span className="text-[12px] text-ui-text-secondary">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {quick ? (
              <section className={PANEL} aria-label="Quick add">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="iti-cat" className={LABEL}>Category<span className="text-error-normal" aria-hidden>*</span></label>
                    <Select id="iti-cat" className={FIELD} value={f.category} options={CATEGORY_OPTIONS} onValueChange={v => { if (v) set('category', v as ItemCategory); }} />
                  </div>
                  <div>
                    <label htmlFor="iti-name" className={LABEL}>Name (optional)</label>
                    <Input id="iti-name" maxLength={120} className={FIELD} value={f.name} onChange={e => set('name', e.target.value)} placeholder={`New ${CATEGORY_LABEL[f.category]}`} />
                  </div>
                  <div>
                    <label htmlFor="iti-loc" className={LABEL}>Office (optional)</label>
                    <Select id="iti-loc" className={FIELD} value={f.location} options={LOCATION_OPTIONS} onValueChange={v => set('location', v ?? '')} />
                  </div>
                </div>
              </section>
            ) : (
              <>
                <section className={PANEL} aria-labelledby="iti-basic">
                  <h3 id="iti-basic" className={PANEL_TITLE}>Basic Info</h3>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <label htmlFor="iti-photo"
                      className="relative grid size-[180px] shrink-0 cursor-pointer place-items-center self-center overflow-hidden rounded-[10px] border border-dashed border-primary-200 bg-white text-center hover:bg-ui-hover-bg md:self-start dark:border-primary-500 dark:bg-secondary-800">
                      {preview ? <Image src={preview} alt="" fill unoptimized sizes="180px" className="object-contain p-3" />
                        : <span className="flex flex-col items-center gap-1.5 px-3 text-[12px] text-ui-text-secondary"><ImagePlus size={28} strokeWidth={1.5} aria-hidden />{editing ? 'Replace photo' : 'Add a photo'}</span>}
                      <input id="iti-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
                    </label>
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2">
                        <label htmlFor="iti-name" className={LABEL}>Item Name<span className="text-error-normal" aria-hidden>*</span></label>
                        <Input id="iti-name" required maxLength={120} autoFocus className={FIELD} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Corsair 154F" />
                      </div>
                      <div>
                        <label htmlFor="iti-cat" className={LABEL}>Category<span className="text-error-normal" aria-hidden>*</span></label>
                        <Select id="iti-cat" className={FIELD} value={f.category} options={CATEGORY_OPTIONS} onValueChange={v => { if (v) set('category', v as ItemCategory); }} />
                      </div>
                      <div>
                        <label htmlFor="iti-model" className={LABEL}>Type</label>
                        <Input id="iti-model" maxLength={120} className={FIELD} value={f.model} onChange={e => set('model', e.target.value)} placeholder="High Performance" />
                      </div>
                      <div>
                        <label htmlFor="iti-loc" className={LABEL}>Location</label>
                        <Select id="iti-loc" className={FIELD} value={f.location} options={LOCATION_OPTIONS} onValueChange={v => set('location', v ?? '')} />
                      </div>
                      <div>
                        <label htmlFor="iti-status" className={LABEL}>Status</label>
                        <Select id="iti-status" className={FIELD} value={f.status} options={STATUS_OPTIONS} onValueChange={v => { if (v) set('status', v as ItemStatus); }} />
                      </div>
                      {f.status === 'assigned' ? (
                        <div>
                          <label htmlFor="iti-holder" className={LABEL}>Held by<span className="text-error-normal" aria-hidden>*</span></label>
                          <Select id="iti-holder" className={FIELD} value={f.assigneeId} placeholder="Choose a person…"
                            options={assignees.map(a => ({ value: a.id, label: a.name }))} onValueChange={v => set('assigneeId', v ?? '')} />
                        </div>
                      ) : <div className="hidden lg:block" />}
                      <div>
                        <label htmlFor="iti-set" className={LABEL}>Set</label>
                        <Input id="iti-set" maxLength={40} className={FIELD} value={f.setLabel} onChange={e => set('setLabel', e.target.value)} placeholder="PC 1" title="Items with the same set name are grouped together" />
                      </div>
                      {f.category === 'phone' && (
                        <div className="sm:col-span-2">
                          <label htmlFor="iti-phone" className={LABEL}>Phone Number</label>
                          <Input id="iti-phone" maxLength={40} inputMode="tel" className={FIELD} value={f.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} placeholder="+1 (475) 309-0034" />
                          <span className="mt-1 block text-[11px] text-ui-text-secondary">Added to Phone Numbers — fill in the carrier and SIM details there.</span>
                        </div>
                      )}
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label htmlFor="iti-notes" className={LABEL}>Notes</label>
                        <Textarea id="iti-notes" maxLength={2000} rows={2} className={FORM_TEXTAREA} value={f.notes} onChange={e => set('notes', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </section>

                {computer && (
                  <section className={PANEL} aria-labelledby="iti-specs">
                    <h3 id="iti-specs" className={PANEL_TITLE}>Specifications</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {SPEC_KEYS.map(k => {
                        const Icon = SPEC_ICON[k];
                        return (
                          <label key={k} htmlFor={`iti-${k}`} className="flex h-16 items-end gap-2.5 rounded-lg border border-solid border-primary-100 bg-white py-3 pl-3.5 pr-4 dark:border-transparent dark:bg-secondary-800">
                            <Icon className={cn('size-[31px] shrink-0', STRONG)} strokeWidth={1.5} />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="text-[12px] font-medium uppercase leading-4 tracking-[-0.264px] text-ui-text-secondary">{SPEC_LABEL[k]}</span>
                              <input id={`iti-${k}`} maxLength={120} value={f.specs[k] ?? ''} onChange={e => set('specs', { ...f.specs, [k]: e.target.value })}
                                placeholder={k === 'cpu' ? 'i7-13700K' : k === 'gpu' ? 'RTX 4070 Ti' : k === 'ram' ? '64 GB' : '2 TB'}
                                className={cn('w-full min-w-0 border-0 bg-transparent p-0 text-[18px] font-semibold leading-5 outline-none placeholder:font-normal placeholder:text-primary-300', STRONG)} />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div>
                      <label htmlFor="iti-remote" className={LABEL}>Remote address</label>
                      <Input id="iti-remote" maxLength={253} className={FIELD} value={f.remoteAddress} onChange={e => set('remoteAddress', e.target.value)}
                        placeholder="pc-ahmet or 100.64.0.12" spellCheck={false} autoCapitalize="off" />
                      <span className="mt-1 block text-[11px] text-ui-text-secondary">Computer name or IP for Remote Desktop: the LAN name in Istanbul, the Tailscale name / IP for the other offices.</span>
                    </div>
                  </section>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 border-t border-ui-divider pt-4">
              <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>Cancel</button>
              <button type="submit" disabled={saving} className={PRIMARY_BTN}>
                {saving ? 'Saving…' : editing ? 'Save' : quick ? <><QrCode size={16} aria-hidden /> Add &amp; get QR</> : 'Add Item'}
              </button>
            </div>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
