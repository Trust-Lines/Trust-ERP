'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
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
} from '@/lib/it/constants';
import { CATEGORY_LABEL } from './itemStyles';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Items Library → Add Item and Item → Edit Info: one form for the whole item (PATCH sends it all
// back). Specs and the remote address only show for computers (Full Set, PC, Laptop).

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
}

export const EMPTY_ITEM: ItItemFormValues = {
  name: '', model: '', category: 'pc', location: '', status: 'available', assigneeId: '',
  setLabel: '', notes: '', specs: {}, remoteAddress: '',
};

export const LABEL = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
// Platform Input / Select at the dialog's 40px field height.
const FIELD = 'h-10 w-full';
export const PRIMARY_BTN =
  'inline-flex h-10 items-center justify-center rounded-md bg-secondary-700 px-6 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-secondary-50 dark:text-primary-950';
export const SECONDARY_BTN =
  'inline-flex h-10 items-center justify-center rounded-md border border-[var(--ui-input-border)] bg-transparent px-6 text-[13px] font-medium text-ui-heading hover:bg-ui-hover-bg';

const STATUS_LABEL: Record<ItemStatus, string> = { available: 'Available', repair: 'Repair', assigned: 'Assigned to a person' };
const CATEGORY_OPTIONS = ITEM_CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABEL[c] }));
const LOCATION_OPTIONS = [{ value: '', label: '—' }, ...IT_LOCATIONS.map(l => ({ value: l, label: l }))];
const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as ItemStatus[]).map(s => ({ value: s, label: STATUS_LABEL[s] }));

async function errorOf(res: Response) {
  const j = await res.json().catch(() => null) as { error?: string } | null;
  return j?.error ?? `Request failed (${res.status})`;
}

export function ItItemFormDialog({ initial, assignees, onClose, onSaved }: {
  initial: ItItemFormValues;
  assignees: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [f, setF] = useState<ItItemFormValues>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!initial.id;
  const computer = COMPUTER_CATEGORIES.includes(f.category);
  const set = <K extends keyof ItItemFormValues>(k: K, v: ItItemFormValues[K]) => setF(p => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    // The platform Select has no native `required`, so check the holder here.
    if (f.status === 'assigned' && !f.assigneeId) {
      toast.error('Choose who holds this item');
      return;
    }
    if (photo && (!IT_IMAGE_TYPES[photo.type] || photo.size > IT_FILE_MAX_BYTES)) {
      toast.error('The photo must be a JPG, PNG or WebP under 4 MB');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/it/items/${initial.id}` : '/api/it/items', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, assigneeId: f.status === 'assigned' ? f.assigneeId : null }),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      const id = editing ? initial.id! : ((await res.json()) as { item: { id: string } }).item.id;
      if (photo) {
        const body = new FormData();
        body.append('file', photo);
        const up = await fetch(`/api/it/items/${id}/image`, { method: 'POST', body });
        if (!up.ok) toast.error(`Saved, but the photo failed: ${await errorOf(up)}`);
      }
      toast.success(editing ? 'Item updated' : 'Item added');
      onSaved(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <ModalContent size="lg" title={editing ? 'Edit Item' : 'Add Item'} description="IT equipment in the Items Library.">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="iti-name" className={LABEL}>Item name<span className="text-error-normal" aria-hidden>*</span></label>
              <Input id="iti-name" required maxLength={120} autoFocus className={FIELD} value={f.name} onChange={e => set('name', e.target.value)} placeholder="PC 1 Tower" />
            </div>
            <div>
              <label htmlFor="iti-cat" className={LABEL}>Category<span className="text-error-normal" aria-hidden>*</span></label>
              <Select id="iti-cat" className={FIELD} value={f.category} options={CATEGORY_OPTIONS}
                onValueChange={v => { if (v) set('category', v as ItemCategory); }} />
            </div>
            <div>
              <label htmlFor="iti-model" className={LABEL}>Type / model</label>
              <Input id="iti-model" maxLength={120} className={FIELD} value={f.model} onChange={e => set('model', e.target.value)} placeholder="High Performance" />
            </div>
            <div>
              <label htmlFor="iti-loc" className={LABEL}>Location</label>
              <Select id="iti-loc" className={FIELD} value={f.location} options={LOCATION_OPTIONS}
                onValueChange={v => set('location', v ?? '')} />
            </div>
            <div>
              <label htmlFor="iti-status" className={LABEL}>Status</label>
              <Select id="iti-status" className={FIELD} value={f.status} options={STATUS_OPTIONS}
                onValueChange={v => { if (v) set('status', v as ItemStatus); }} />
            </div>
            {f.status === 'assigned' ? (
              <div>
                <label htmlFor="iti-holder" className={LABEL}>Held by<span className="text-error-normal" aria-hidden>*</span></label>
                <Select id="iti-holder" className={FIELD} value={f.assigneeId} placeholder="Choose a person…"
                  options={assignees.map(a => ({ value: a.id, label: a.name }))}
                  onValueChange={v => set('assigneeId', v ?? '')} />
              </div>
            ) : <div className="hidden sm:block" />}
            <div>
              <label htmlFor="iti-set" className={LABEL}>Set</label>
              <Input id="iti-set" maxLength={40} className={FIELD} value={f.setLabel} onChange={e => set('setLabel', e.target.value)} placeholder="PC 1" />
              <span className="mt-1 block text-[11px] text-ui-text-secondary">Items with the same set name are grouped together.</span>
            </div>
            <div>
              <label htmlFor="iti-photo" className={LABEL}>Photo</label>
              <Input id="iti-photo" type="file" accept="image/jpeg,image/png,image/webp" className={`${FIELD} py-1.5 text-[12px]`} onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          {computer && (
            <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
              <legend className="mb-3 text-[13px] font-semibold text-ui-heading">Computer</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {SPEC_KEYS.map(k => (
                  <div key={k}>
                    <label htmlFor={`iti-${k}`} className={LABEL}>{SPEC_LABEL[k]}</label>
                    <Input id={`iti-${k}`} maxLength={120} className={FIELD} value={f.specs[k] ?? ''}
                      onChange={e => set('specs', { ...f.specs, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div>
                <label htmlFor="iti-remote" className={LABEL}>Remote address</label>
                <Input id="iti-remote" maxLength={253} className={FIELD} value={f.remoteAddress} onChange={e => set('remoteAddress', e.target.value)}
                  placeholder="pc-ahmet or 100.64.0.12" spellCheck={false} autoCapitalize="off" />
                <span className="mt-1 block text-[11px] text-ui-text-secondary">
                  Computer name or IP for Remote Desktop: the LAN name in Istanbul, the Tailscale name / IP for the other offices.
                </span>
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="iti-notes" className={LABEL}>Notes</label>
            <Textarea id="iti-notes" maxLength={2000} rows={3} className="min-h-0 w-full" value={f.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 border-t border-ui-divider pt-4">
            <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>Cancel</button>
            <button type="submit" disabled={saving} className={PRIMARY_BTN}>{saving ? 'Saving…' : editing ? 'Save' : 'Add Item'}</button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
