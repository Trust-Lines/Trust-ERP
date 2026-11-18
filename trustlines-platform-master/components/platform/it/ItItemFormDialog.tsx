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
export const FIELD =
  'min-h-[40px] w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-disabled focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
export const PRIMARY_BTN =
  'inline-flex h-10 items-center justify-center rounded-md bg-secondary-700 px-6 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-secondary-50 dark:text-primary-950';
export const SECONDARY_BTN =
  'inline-flex h-10 items-center justify-center rounded-md border border-[var(--ui-input-border)] bg-transparent px-6 text-[13px] font-medium text-ui-heading hover:bg-ui-hover-bg';

const STATUS_LABEL: Record<ItemStatus, string> = { available: 'Available', repair: 'Repair', assigned: 'Assigned to a person' };

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
              <input id="iti-name" required maxLength={120} autoFocus className={FIELD} value={f.name} onChange={e => set('name', e.target.value)} placeholder="PC 1 Tower" />
            </div>
            <div>
              <label htmlFor="iti-cat" className={LABEL}>Category<span className="text-error-normal" aria-hidden>*</span></label>
              <select id="iti-cat" className={FIELD} value={f.category} onChange={e => set('category', e.target.value as ItemCategory)}>
                {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="iti-model" className={LABEL}>Type / model</label>
              <input id="iti-model" maxLength={120} className={FIELD} value={f.model} onChange={e => set('model', e.target.value)} placeholder="High Performance" />
            </div>
            <div>
              <label htmlFor="iti-loc" className={LABEL}>Location</label>
              <select id="iti-loc" className={FIELD} value={f.location} onChange={e => set('location', e.target.value)}>
                <option value="">—</option>
                {IT_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="iti-status" className={LABEL}>Status</label>
              <select id="iti-status" className={FIELD} value={f.status} onChange={e => set('status', e.target.value as ItemStatus)}>
                {(Object.keys(STATUS_LABEL) as ItemStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            {f.status === 'assigned' ? (
              <div>
                <label htmlFor="iti-holder" className={LABEL}>Held by<span className="text-error-normal" aria-hidden>*</span></label>
                <select id="iti-holder" required className={FIELD} value={f.assigneeId} onChange={e => set('assigneeId', e.target.value)}>
                  <option value="">Choose a person…</option>
                  {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            ) : <div className="hidden sm:block" />}
            <div>
              <label htmlFor="iti-set" className={LABEL}>Set</label>
              <input id="iti-set" maxLength={40} className={FIELD} value={f.setLabel} onChange={e => set('setLabel', e.target.value)} placeholder="PC 1" />
              <span className="mt-1 block text-[11px] text-ui-text-secondary">Items with the same set name are grouped together.</span>
            </div>
            <div>
              <label htmlFor="iti-photo" className={LABEL}>Photo</label>
              <input id="iti-photo" type="file" accept="image/jpeg,image/png,image/webp" className={`${FIELD} py-2 text-[12px]`} onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          {computer && (
            <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
              <legend className="mb-3 text-[13px] font-semibold text-ui-heading">Computer</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {SPEC_KEYS.map(k => (
                  <div key={k}>
                    <label htmlFor={`iti-${k}`} className={LABEL}>{SPEC_LABEL[k]}</label>
                    <input id={`iti-${k}`} maxLength={120} className={FIELD} value={f.specs[k] ?? ''}
                      onChange={e => set('specs', { ...f.specs, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div>
                <label htmlFor="iti-remote" className={LABEL}>Remote address</label>
                <input id="iti-remote" maxLength={253} className={FIELD} value={f.remoteAddress} onChange={e => set('remoteAddress', e.target.value)}
                  placeholder="pc-ahmet or 100.64.0.12" spellCheck={false} autoCapitalize="off" />
                <span className="mt-1 block text-[11px] text-ui-text-secondary">
                  Computer name or IP for Remote Desktop: the LAN name in Istanbul, the Tailscale name / IP for the other offices.
                </span>
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="iti-notes" className={LABEL}>Notes</label>
            <textarea id="iti-notes" maxLength={2000} rows={3} className={`${FIELD} py-2`} value={f.notes} onChange={e => set('notes', e.target.value)} />
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
