'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { IT_LOCATIONS } from '@/lib/it/constants';
import type { PhoneAccount } from '@/lib/it/phones';
import { cn } from '@/lib/utils';
import { FORM_FIELD, FORM_TEXTAREA, FormActions, FormField, FormPanel, FormValue, LABEL } from './itFormParts';
import { formatTicketDate } from './ticketStyles';

// IT → Phone Numbers → New Number (pop-up) and the line's Edit Info (inside the line's own pop-up),
// in the IT form system (itFormParts). ItPhoneForm is the form; ItPhoneFormDialog puts it in a modal.
// Laid out like the "Phones and sim cards info" sheet: User & Phone (staff member or a typed name;
// company phone with model / condition / IMEI, personal phone, or none), Line (number, mail,
// password, PIN, location) and Carrier Account (carrier, firm, account holder, account number,
// plan per month). "Same account as" fills the account from a line already on it — its account
// number is copied on the server. No dates to type: a new holder / company phone is dated today.
// Password / PIN / account number are write-only: left empty when editing = unchanged.
// A company phone can be picked from the Items Library (migration 163): the line then runs on that
// item, both pages link to each other, and the model is the item's name.

export interface ItPhoneFormValues {
  id?: string;
  number: string; carrier: string; firm: string; accountHolder: string;
  /** USD per month, as typed. */
  monthlyCost: string;
  holderId: string;
  /** A user with no account / email yet (holderId empty). */
  holderName: string;
  deviceName: string; personalDevice: boolean; deviceCondition: '' | 'new' | 'used';
  /** The Items Library phone ('' = not in the library). */
  itemId: string;
  email: string; imei: string; location: string; notes: string;
  active: boolean;
  /** Edit only, read-only: dates the system set. */
  holderSince?: string | null;
  deviceAssignedAt?: string | null;
  /** Edit only: which secrets are already stored. */
  hasSecret?: { password: boolean; pin: boolean; accountNumber: boolean };
}

export const EMPTY_PHONE: ItPhoneFormValues = {
  number: '', carrier: '', firm: '', accountHolder: '', monthlyCost: '', holderId: '', holderName: '',
  deviceName: '', personalDevice: false, deviceCondition: '', itemId: '', email: '', imei: '', location: '', notes: '', active: true,
};

type HolderMode = 'staff' | 'name';
type PhoneMode = 'company' | 'personal' | 'none';

export const LOCATION_OPTIONS = [{ value: '', label: '—' }, ...IT_LOCATIONS.map(l => ({ value: l, label: l }))];
export const CONDITION_OPTIONS = [{ value: '', label: '—' }, { value: 'new', label: 'New' }, { value: 'used', label: 'Used' }];
export const accountLabel = (a: PhoneAccount) => [a.carrier, a.firm, a.accountHolder].filter(Boolean).join(' · ') || 'Account';

/** A row of choice buttons (radio group) in the form style. */
export function Segmented<T extends string>({ id, label, value, options, onChange }: {
  id: string; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="min-w-0">
      <span id={id} className={LABEL}>{label}</span>
      <div role="radiogroup" aria-labelledby={id} className="flex h-[42px] gap-1 rounded-md border border-primary-100 bg-white p-1 dark:border-transparent dark:bg-secondary-800">
        {options.map(o => (
          <button
            key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
            className={cn(
              'min-w-0 flex-1 truncate rounded px-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ui-focus-ring',
              value === o.value
                ? 'bg-secondary-700 text-white dark:bg-secondary-50 dark:text-primary-950'
                : 'text-ui-body hover:bg-ui-hover-bg',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function withAccount(v: ItPhoneFormValues, a: PhoneAccount | undefined): ItPhoneFormValues {
  if (!a) return v;
  return { ...v, carrier: a.carrier ?? '', firm: a.firm ?? '', accountHolder: a.accountHolder ?? '', location: v.location || a.location || '' };
}

/**
 * The line form's state and save, shared by the New Number pop-up (ItPhoneForm) and the line pop-up's
 * in-place edit (ItPhoneQuickView), which lays the same fields out like its details.
 */
export function usePhoneForm({ initial, accounts = [], phoneItems = [], onSaved }: {
  initial: ItPhoneFormValues;
  accounts?: PhoneAccount[];
  phoneItems?: { id: string; name: string; lineId: string | null }[];
  onSaved: (id: string) => void;
}) {
  const editing = !!initial.id;
  // A new line starts on the most recent account — most lines share one.
  const [accountFrom, setAccountFrom] = useState(editing ? '' : accounts[0]?.lineId ?? '');
  const [f, setF] = useState<ItPhoneFormValues>(() => (editing ? initial : withAccount(initial, accounts[0])));
  const [holderMode, setHolderMode] = useState<HolderMode>(!initial.holderId && initial.holderName ? 'name' : 'staff');
  const [phoneMode, setPhoneMode] = useState<PhoneMode>(initial.deviceName ? 'company' : initial.personalDevice ? 'personal' : 'none');
  const [secrets, setSecrets] = useState({ password: '', pin: '', accountNumber: '' });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ItPhoneFormValues>(k: K, v: ItPhoneFormValues[K]) => setF(p => ({ ...p, [k]: v }));
  const secret = (k: keyof typeof secrets) => (e: { target: { value: string } }) => setSecrets(s => ({ ...s, [k]: e.target.value }));

  const holderKey = holderMode === 'staff' ? f.holderId : f.holderName.trim().toLowerCase();
  const initialKey = initial.holderId || initial.holderName.trim().toLowerCase();
  const holderChanged = holderKey !== initialKey;
  const itemId = phoneMode === 'company' ? f.itemId : '';
  const libraryOptions = [
    { value: '', label: 'Not in the library (type the model)' },
    ...phoneItems.filter(i => !i.lineId || i.lineId === initial.id || i.id === initial.itemId).map(i => ({ value: i.id, label: i.name })),
  ];
  const deviceName = phoneMode === 'company' ? f.deviceName.trim() : '';
  const deviceChanged = deviceName !== initial.deviceName.trim();
  const chosenAccount = accounts.find(a => a.lineId === accountFrom);

  function pickAccount(lineId: string) {
    setAccountFrom(lineId);
    const a = accounts.find(x => x.lineId === lineId);
    if (a) setF(p => withAccount(p, a));
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (phoneMode === 'company' && !deviceName) { toast.error('Enter the company phone’s model, e.g. iPhone 12'); return; }
    setSaving(true);
    try {
      // Secrets: sent only when typed, so an empty box never wipes a saved one.
      const typed = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v.trim()));
      const res = await fetch(editing ? `/api/it/phones/${initial.id}` : '/api/it/phones', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: f.number, email: f.email, location: f.location, notes: f.notes,
          holderId: holderMode === 'staff' ? f.holderId : '',
          holderName: holderMode === 'name' ? f.holderName : '',
          deviceName, personalDevice: phoneMode === 'personal', itemId,
          deviceCondition: phoneMode === 'company' ? f.deviceCondition : '',
          imei: phoneMode === 'none' ? '' : f.imei,
          carrier: f.carrier, firm: f.firm, accountHolder: f.accountHolder, monthlyCost: f.monthlyCost,
          ...(editing ? { active: f.active } : {}), ...typed,
          ...(accountFrom && !secrets.accountNumber.trim() ? { copyAccountFrom: accountFrom } : {}),
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
  const suggest = (k: 'carrier' | 'firm' | 'accountHolder') => [...new Set(accounts.map(a => a[k]).filter((v): v is string => !!v))];
  const accountPlaceholder = chosenAccount?.hasAccountNumber
    ? 'Same as the chosen account'
    : editing && initial.hasSecret?.accountNumber ? 'Saved. Type to replace.' : '';


  return {
    editing, f, set, setF, holderMode, setHolderMode, phoneMode, setPhoneMode, secrets, secret, saving, submit,
    accountFrom, pickAccount, libraryOptions, holderChanged, holderKey, deviceName, deviceChanged, since, suggest, accountPlaceholder,
  };
}

export function ItPhoneForm({ initial, people, accounts = [], phoneItems = [], onClose, onSaved, onBusy, className }: {
  initial: ItPhoneFormValues;
  people: { id: string; name: string }[];
  /** Items Library phones and the line each runs (lineId null = free). */
  phoneItems?: { id: string; name: string; lineId: string | null }[];
  /** Accounts already in use, for "Same account as" (newest first). */
  accounts?: PhoneAccount[];
  onClose: () => void;
  onSaved: (id: string) => void;
  /** Told while saving, so the surrounding pop-up doesn't close mid-save. */
  onBusy?: (busy: boolean) => void;
  className?: string;
}) {
  const {
    editing, f, set, setF, holderMode, setHolderMode, phoneMode, setPhoneMode, secrets, secret, saving, submit,
    accountFrom, pickAccount, libraryOptions, holderChanged, holderKey, deviceName, deviceChanged, since, suggest, accountPlaceholder,
  } = usePhoneForm({ initial, accounts, phoneItems, onSaved });
  useEffect(() => { onBusy?.(saving); }, [saving, onBusy]);

  return (
        <form onSubmit={submit} className={cn('flex flex-col gap-5', className)}>
          <FormPanel id="itp-user-panel" title="User & Phone" aside="Dates are set automatically when you assign">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Segmented id="itp-user-mode" label="User" value={holderMode} onChange={setHolderMode}
                  options={[{ value: 'staff', label: 'Staff member' }, { value: 'name', label: 'Type a name' }]} />
                {holderMode === 'staff' ? (
                  <Select id="itp-holder" aria-label="Staff member" className={FORM_FIELD} value={f.holderId} placeholder="Available (nobody)"
                    options={[{ value: '', label: 'Available (nobody)' }, ...people.map(p => ({ value: p.id, label: p.name }))]}
                    onValueChange={v => set('holderId', v ?? '')} />
                ) : (
                  <Input id="itp-holder-name" aria-label="User's name" maxLength={120} className={FORM_FIELD} value={f.holderName}
                    onChange={e => set('holderName', e.target.value)} placeholder="Full name (no account or email yet)" />
                )}
              </div>
              <FormField id="itp-since" label="Holder since">
                <FormValue>{since(initial.holderSince, holderChanged, !!holderKey)}</FormValue>
              </FormField>
            </div>

            <Segmented id="itp-phone-mode" label="Phone" value={phoneMode} onChange={setPhoneMode}
              options={[{ value: 'company', label: 'Company phone' }, { value: 'personal', label: 'Personal phone' }, { value: 'none', label: 'No phone' }]} />
            {phoneMode === 'company' && phoneItems.length > 0 && (
              <FormField id="itp-item" label="Phone from the Items Library" hint="Links the line and the phone: each page shows the other">
                <Select id="itp-item" className={FORM_FIELD} value={f.itemId} options={libraryOptions}
                  onValueChange={v => {
                    const item = phoneItems.find(i => i.id === v);
                    setF(p => ({ ...p, itemId: v ?? '', deviceName: item ? item.name : p.itemId ? '' : p.deviceName }));
                  }} />
              </FormField>
            )}
            {phoneMode !== 'none' && (
              <div className={cn('grid grid-cols-1 gap-4', phoneMode === 'company' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2')}>
                {phoneMode === 'company' && <>
                  <FormField id="itp-device" label="Model" required>
                    <Input id="itp-device" maxLength={80} className={FORM_FIELD} value={f.deviceName} onChange={e => set('deviceName', e.target.value)} placeholder="iPhone 12"
                      readOnly={!!f.itemId} title={f.itemId ? 'The library item’s name' : undefined} />
                  </FormField>
                  <FormField id="itp-cond" label="Condition">
                    <Select id="itp-cond" className={FORM_FIELD} value={f.deviceCondition} options={CONDITION_OPTIONS}
                      onValueChange={v => set('deviceCondition', (v ?? '') as ItPhoneFormValues['deviceCondition'])} />
                  </FormField>
                </>}
                <FormField id="itp-imei" label="IMEI">
                  <Input id="itp-imei" maxLength={40} inputMode="numeric" className={FORM_FIELD} value={f.imei} onChange={e => set('imei', e.target.value)} placeholder="357716584828487" />
                </FormField>
                {phoneMode === 'company' && (
                  <FormField id="itp-dev-at" label="Phone assigned on">
                    <FormValue>{since(initial.deviceAssignedAt, deviceChanged, !!deviceName)}</FormValue>
                  </FormField>
                )}
              </div>
            )}
          </FormPanel>

          <FormPanel id="itp-line" title="Line" aside="Password and PIN stored encrypted">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField id="itp-number" label="Number" required>
                <Input id="itp-number" required maxLength={40} autoFocus inputMode="tel" className={FORM_FIELD} value={f.number} onChange={e => set('number', e.target.value)} placeholder="+1 (475) 309-0034" />
              </FormField>
              <FormField id="itp-mail" label="Mail">
                <Input id="itp-mail" type="email" maxLength={254} className={FORM_FIELD} value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@tlines.us" />
              </FormField>
              <FormField id="itp-loc" label="Location">
                <Select id="itp-loc" className={FORM_FIELD} value={f.location} options={LOCATION_OPTIONS} onValueChange={v => set('location', v ?? '')} />
              </FormField>
              <FormField id="itp-password" label="Password">
                <Input id="itp-password" type="password" autoComplete="new-password" maxLength={200} className={FORM_FIELD} value={secrets.password}
                  onChange={secret('password')} placeholder={editing && initial.hasSecret?.password ? 'Saved. Type to replace.' : ''} />
              </FormField>
              <FormField id="itp-pin" label="PIN">
                <Input id="itp-pin" type="password" autoComplete="new-password" maxLength={200} inputMode="numeric" className={FORM_FIELD} value={secrets.pin}
                  onChange={secret('pin')} placeholder={editing && initial.hasSecret?.pin ? 'Saved. Type to replace.' : ''} />
              </FormField>
            </div>
          </FormPanel>

          <FormPanel id="itp-account" title="Carrier Account" aside="Account number stored encrypted">
            {accounts.length > 0 && (
              <FormField id="itp-same" label="Same account as" hint="Fills carrier, firm and account holder, and uses that account’s number">
                <Select id="itp-same" className={FORM_FIELD} value={accountFrom}
                  options={[{ value: '', label: editing ? 'Keep as is' : 'A new account' }, ...accounts.map(a => ({ value: a.lineId, label: accountLabel(a) }))]}
                  onValueChange={v => pickAccount(v ?? '')} />
              </FormField>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField id="itp-carrier" label="Carrier">
                <Input id="itp-carrier" list="itp-carrier-list" maxLength={80} className={FORM_FIELD} value={f.carrier} onChange={e => set('carrier', e.target.value)} placeholder="T-Mobile" />
              </FormField>
              <FormField id="itp-firm" label="Firm name">
                <Input id="itp-firm" list="itp-firm-list" maxLength={80} className={FORM_FIELD} value={f.firm} onChange={e => set('firm', e.target.value)} placeholder="T LINES LLC" />
              </FormField>
              <FormField id="itp-acc-holder" label="Account holder">
                <Input id="itp-acc-holder" list="itp-acc-holder-list" maxLength={120} className={FORM_FIELD} value={f.accountHolder} onChange={e => set('accountHolder', e.target.value)} placeholder="Name on the carrier account" />
              </FormField>
              <FormField id="itp-accountNumber" label="Account no">
                <Input id="itp-accountNumber" type="password" autoComplete="new-password" maxLength={200} className={FORM_FIELD} value={secrets.accountNumber}
                  onChange={secret('accountNumber')} placeholder={accountPlaceholder} />
              </FormField>
              <FormField id="itp-cost" label="Plan / month (USD)">
                <Input id="itp-cost" type="number" min={0} max={100000} step="0.01" inputMode="decimal" className={FORM_FIELD} value={f.monthlyCost}
                  onChange={e => set('monthlyCost', e.target.value)} placeholder="58.10" />
              </FormField>
            </div>
            <datalist id="itp-carrier-list">{suggest('carrier').map(v => <option key={v} value={v} />)}</datalist>
            <datalist id="itp-firm-list">{suggest('firm').map(v => <option key={v} value={v} />)}</datalist>
            <datalist id="itp-acc-holder-list">{suggest('accountHolder').map(v => <option key={v} value={v} />)}</datalist>
          </FormPanel>

          <FormPanel id="itp-notes-panel" title="Notes">
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
  );
}

/** New Number: the form in a modal. */
export function ItPhoneFormDialog(props: Omit<Parameters<typeof ItPhoneForm>[0], 'onBusy' | 'className'>) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onOpenChange={o => { if (!o && !busy) props.onClose(); }}>
      <ModalContent size="xl" title={props.initial.id ? 'Edit Number' : 'New Number'} description="A company phone line and SIM.">
        <ItPhoneForm {...props} onBusy={setBusy} className="max-h-[72vh] overflow-y-auto pr-1" />
      </ModalContent>
    </Modal>
  );
}
