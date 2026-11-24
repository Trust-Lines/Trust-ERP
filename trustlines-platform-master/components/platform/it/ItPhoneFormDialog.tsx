'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { IT_LOCATIONS } from '@/lib/it/constants';
import { FORM_FIELD, FORM_TEXTAREA, FormActions, FormField, FormPanel, FormValue } from './itFormParts';
import { formatTicketDate } from './ticketStyles';

// IT → Phone Numbers → New Number and the line's Edit Info: one form, in the IT form system
// (itFormParts). No dates to type: the server dates a new holder / company phone today and keeps
// the line's assignment history. Password / PIN / account number are write-only here: left empty
// when editing = unchanged (a saved one shows as "saved").

export interface ItPhoneFormValues {
  id?: string;
  number: string; carrier: string; firm: string;
  holderId: string;
  deviceName: string; personalDevice: boolean;
  email: string; imei: string; location: string; notes: string;
  active: boolean;
  /** Edit only, read-only: dates the system set. */
  holderSince?: string | null;
  deviceAssignedAt?: string | null;
  /** Edit only: which secrets are already stored. */
  hasSecret?: { password: boolean; pin: boolean; accountNumber: boolean };
}

export const EMPTY_PHONE: ItPhoneFormValues = {
  number: '', carrier: '', firm: '', holderId: '', deviceName: '', personalDevice: false,
  email: '', imei: '', location: '', notes: '', active: true,
};

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

  const holderChanged = f.holderId !== initial.holderId;
  const deviceChanged = f.deviceName.trim() !== initial.deviceName.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { number, carrier, firm, holderId, deviceName, personalDevice, email, imei, location, notes, active } = f;
      // Secrets: sent only when typed, so an empty box never wipes a saved one.
      const typed = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v.trim()));
      const res = await fetch(editing ? `/api/it/phones/${initial.id}` : '/api/it/phones', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number, carrier, firm, holderId, deviceName, personalDevice: !deviceName.trim() && personalDevice,
          email, imei, location, notes, ...(editing ? { active } : {}), ...typed,
        }),
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

  const since = (iso: string | null | undefined, changed: boolean, has: boolean) =>
    !has ? '—' : changed || !editing ? 'Today, when you save' : formatTicketDate(iso ?? null);

  return (
    <Modal open onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <ModalContent size="xl" title={editing ? 'Edit Number' : 'New Number'} description="A company phone line.">
        <form onSubmit={submit} className="flex max-h-[72vh] flex-col gap-5 overflow-y-auto pr-1">
          <FormPanel id="itp-line" title="Line">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField id="itp-number" label="Number" required>
                <Input id="itp-number" required maxLength={40} autoFocus inputMode="tel" className={FORM_FIELD} value={f.number} onChange={e => set('number', e.target.value)} placeholder="+1 (555) 555 1234" />
              </FormField>
              <FormField id="itp-carrier" label="Carrier">
                <Input id="itp-carrier" maxLength={80} className={FORM_FIELD} value={f.carrier} onChange={e => set('carrier', e.target.value)} placeholder="T-Mobile" />
              </FormField>
              <FormField id="itp-firm" label="Firm">
                <Input id="itp-firm" maxLength={80} className={FORM_FIELD} value={f.firm} onChange={e => set('firm', e.target.value)} placeholder="Trust Lines" />
              </FormField>
              <FormField id="itp-loc" label="Location">
                <Select id="itp-loc" className={FORM_FIELD} value={f.location} options={LOCATION_OPTIONS} onValueChange={v => set('location', v ?? '')} />
              </FormField>
              <FormField id="itp-mail" label="Mail">
                <Input id="itp-mail" type="email" maxLength={254} className={FORM_FIELD} value={f.email} onChange={e => set('email', e.target.value)} placeholder="Carrier account login" />
              </FormField>
              <FormField id="itp-imei" label="IMEI">
                <Input id="itp-imei" maxLength={40} inputMode="numeric" className={FORM_FIELD} value={f.imei} onChange={e => set('imei', e.target.value)} />
              </FormField>
            </div>
          </FormPanel>

          <FormPanel id="itp-holder-panel" title="Holder & Device" aside="Dates are set automatically when you assign">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="itp-holder" label="Holder">
                <Select id="itp-holder" className={FORM_FIELD} value={f.holderId} placeholder="Available (nobody)"
                  options={[{ value: '', label: 'Available (nobody)' }, ...people.map(p => ({ value: p.id, label: p.name }))]}
                  onValueChange={v => set('holderId', v ?? '')} />
              </FormField>
              <FormField id="itp-since" label="Holder since">
                <FormValue>{since(initial.holderSince, holderChanged, !!f.holderId)}</FormValue>
              </FormField>
              <FormField id="itp-device" label="Company phone" hint="Empty when the line has no company phone">
                <Input id="itp-device" maxLength={80} className={FORM_FIELD} value={f.deviceName} onChange={e => set('deviceName', e.target.value)} placeholder="iPhone 17" />
              </FormField>
              <FormField id="itp-dev-at" label="Phone assigned on">
                <FormValue>{since(initial.deviceAssignedAt, deviceChanged, !!f.deviceName.trim())}</FormValue>
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ui-body">
              <Checkbox checked={!f.deviceName.trim() && f.personalDevice} disabled={!!f.deviceName.trim()} onCheckedChange={v => set('personalDevice', !!v)} />
              Runs on the holder&apos;s own phone
            </label>
          </FormPanel>

          <FormPanel id="itp-account" title="Account Details" aside="Stored encrypted">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {SECRET_FIELDS.map(([k, label]) => (
                <FormField key={k} id={`itp-${k}`} label={label}>
                  <Input id={`itp-${k}`} type="password" autoComplete="new-password" maxLength={200} className={FORM_FIELD} value={secrets[k]}
                    onChange={e => setSecrets(s => ({ ...s, [k]: e.target.value }))}
                    placeholder={editing && initial.hasSecret?.[k] ? 'Saved. Type to replace.' : ''} />
                </FormField>
              ))}
            </div>
            <FormField id="itp-notes" label="Notes">
              <Textarea id="itp-notes" maxLength={4000} rows={2} className={FORM_TEXTAREA} value={f.notes} onChange={e => set('notes', e.target.value)} />
            </FormField>
            {editing && (
              <label className="flex items-center gap-2 text-[13px] text-ui-body">
                <Checkbox checked={!f.active} onCheckedChange={v => set('active', !v)} />
                Retired (move to History)
              </label>
            )}
          </FormPanel>

          <FormActions saving={saving} onCancel={onClose} submitLabel={editing ? 'Save' : 'Add Number'} />
        </form>
      </ModalContent>
    </Modal>
  );
}
