'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { IT_LOCATIONS } from '@/lib/it/constants';
import { LABEL, PRIMARY_BTN, SECONDARY_BTN } from './ItItemFormDialog';

// IT → Phone Numbers → New Number and the line's Edit Info: one form. Password / PIN / account
// number are write-only here: left empty when editing = unchanged (a saved one shows as "saved").

export interface ItPhoneFormValues {
  id?: string;
  number: string; carrier: string; firm: string;
  holderId: string; holderSince: string;
  deviceName: string; personalDevice: boolean; deviceAssignedAt: string;
  email: string; imei: string; location: string; startDate: string; notes: string;
  active: boolean;
  /** Edit only: which secrets are already stored. */
  hasSecret?: { password: boolean; pin: boolean; accountNumber: boolean };
}

export const EMPTY_PHONE: ItPhoneFormValues = {
  number: '', carrier: '', firm: '', holderId: '', holderSince: '', deviceName: '', personalDevice: false, deviceAssignedAt: '',
  email: '', imei: '', location: '', startDate: '', notes: '', active: true,
};

const FIELD = 'h-10 w-full';
const LOCATION_OPTIONS = [{ value: '', label: '—' }, ...IT_LOCATIONS.map(l => ({ value: l, label: l }))];
const SECRET_FIELDS = [['password', 'Password'], ['pin', 'PIN'], ['accountNumber', 'Account number']] as const;

export function ItPhoneFormDialog({ initial, people, onClose, onSaved }: {
  initial: ItPhoneFormValues;
  people: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [f, setF] = useState<ItPhoneFormValues>(initial);
  const [secrets, setSecrets] = useState({ password: '', pin: '', accountNumber: '' });
  const [saving, setSaving] = useState(false);
  const editing = !!initial.id;
  const set = <K extends keyof ItPhoneFormValues>(k: K, v: ItPhoneFormValues[K]) => setF(p => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { id: _id, hasSecret: _h, active, ...fields } = f;
      // Secrets: sent only when typed (editing), so an empty box never wipes a saved one.
      const typed = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v.trim()));
      const res = await fetch(editing ? `/api/it/phones/${initial.id}` : '/api/it/phones', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, ...(editing ? { active } : {}), ...typed }),
      });
      const body = await res.json().catch(() => null) as { error?: string; line?: { id: string } } | null;
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      toast.success(editing ? 'Number updated' : 'Number added');
      onSaved(editing ? initial.id! : body!.line!.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the number');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <ModalContent size="lg" title={editing ? 'Edit Number' : 'New Number'} description="A company phone line.">
        <form onSubmit={submit} className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="itp-number" className={LABEL}>Number<span className="text-error-normal" aria-hidden>*</span></label>
              <Input id="itp-number" required maxLength={40} autoFocus inputMode="tel" className={FIELD} value={f.number} onChange={e => set('number', e.target.value)} placeholder="+1 (555) 555 1234" />
            </div>
            <div>
              <label htmlFor="itp-carrier" className={LABEL}>Carrier</label>
              <Input id="itp-carrier" maxLength={80} className={FIELD} value={f.carrier} onChange={e => set('carrier', e.target.value)} placeholder="T-Mobile" />
            </div>
            <div>
              <label htmlFor="itp-firm" className={LABEL}>Firm</label>
              <Input id="itp-firm" maxLength={80} className={FIELD} value={f.firm} onChange={e => set('firm', e.target.value)} placeholder="Trust Lines" />
            </div>
            <div>
              <label htmlFor="itp-loc" className={LABEL}>Location</label>
              <Select id="itp-loc" className={FIELD} value={f.location} options={LOCATION_OPTIONS} onValueChange={v => set('location', v ?? '')} />
            </div>
            <div>
              <label htmlFor="itp-holder" className={LABEL}>Holder</label>
              <Select id="itp-holder" className={FIELD} value={f.holderId} placeholder="Available (nobody)"
                options={[{ value: '', label: 'Available (nobody)' }, ...people.map(p => ({ value: p.id, label: p.name }))]}
                onValueChange={v => set('holderId', v ?? '')} />
            </div>
            <div>
              <label htmlFor="itp-since" className={LABEL}>Holder since</label>
              <Input id="itp-since" type="date" className={FIELD} value={f.holderSince} disabled={!f.holderId} onChange={e => set('holderSince', e.target.value)} />
            </div>
            <div>
              <label htmlFor="itp-device" className={LABEL}>Company phone</label>
              <Input id="itp-device" maxLength={80} className={FIELD} value={f.deviceName} onChange={e => set('deviceName', e.target.value)} placeholder="iPhone 17 (empty = none)" />
            </div>
            <div>
              <label htmlFor="itp-dev-at" className={LABEL}>Phone assigned on</label>
              <Input id="itp-dev-at" type="date" className={FIELD} value={f.deviceAssignedAt} disabled={!f.deviceName.trim()} onChange={e => set('deviceAssignedAt', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ui-body sm:col-span-2">
              <Checkbox checked={f.personalDevice} disabled={!!f.deviceName.trim()} onCheckedChange={v => set('personalDevice', !!v)} />
              Runs on the holder’s own phone
            </label>
            <div>
              <label htmlFor="itp-mail" className={LABEL}>Mail</label>
              <Input id="itp-mail" type="email" maxLength={254} className={FIELD} value={f.email} onChange={e => set('email', e.target.value)} placeholder="account@carrier login" />
            </div>
            <div>
              <label htmlFor="itp-imei" className={LABEL}>IMEI</label>
              <Input id="itp-imei" maxLength={40} className={FIELD} value={f.imei} onChange={e => set('imei', e.target.value)} />
            </div>
            <div>
              <label htmlFor="itp-start" className={LABEL}>Start date</label>
              <Input id="itp-start" type="date" className={FIELD} value={f.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            {editing && (
              <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-ui-body">
                <Checkbox checked={!f.active} onCheckedChange={v => set('active', !v)} />
                Retired (move to History)
              </label>
            )}
          </div>

          <fieldset className="m-0 grid grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-3">
            <legend className="mb-2 text-[13px] font-semibold text-ui-heading">Account details <span className="font-normal text-ui-text-secondary">— stored encrypted</span></legend>
            {SECRET_FIELDS.map(([k, label]) => (
              <div key={k}>
                <label htmlFor={`itp-${k}`} className={LABEL}>{label}</label>
                <Input id={`itp-${k}`} type="password" autoComplete="new-password" maxLength={200} className={FIELD} value={secrets[k]}
                  onChange={e => setSecrets(s => ({ ...s, [k]: e.target.value }))}
                  placeholder={editing && initial.hasSecret?.[k] ? 'Saved — type to replace' : ''} />
              </div>
            ))}
          </fieldset>

          <div>
            <label htmlFor="itp-notes" className={LABEL}>Notes</label>
            <Textarea id="itp-notes" maxLength={4000} rows={3} value={f.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 border-t border-ui-divider pt-4">
            <button type="button" className={SECONDARY_BTN} disabled={saving} onClick={onClose}>Cancel</button>
            <button type="submit" className={PRIMARY_BTN} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save' : 'Add Number'}</button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
