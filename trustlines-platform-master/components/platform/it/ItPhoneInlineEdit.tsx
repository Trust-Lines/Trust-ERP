'use client';

import { useEffect, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { PhoneAccount } from '@/lib/it/phones';
import { FORM_FIELD, FORM_TEXTAREA } from './itFormParts';
import { CONDITION_OPTIONS, LOCATION_OPTIONS, Segmented, accountLabel, usePhoneForm, type ItPhoneFormValues } from './ItPhoneFormDialog';
import { formatTicketDate } from './ticketStyles';
import { STRONG } from './itemStyles';

// The line pop-up's Edit Info: the same layout as its details — the sheet-order grid on the left,
// who holds it and the phone it runs on on the right — with each box turned into its input. State
// and save are the New Number form's (usePhoneForm); the pop-up's header holds Cancel / Save
// (form="itp-inline").

export const INLINE_FORM_ID = 'itp-inline';

const LABEL = 'text-[12px] font-medium leading-4 text-ui-body';
const PANEL = 'flex flex-col gap-3 rounded-[10px] border border-primary-100 bg-primary-50 p-3 dark:border-primary-600 dark:bg-primary-700';

function Box({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

export function ItPhoneInlineEdit({ initial, addedAt, people, accounts, phoneItems, onSaved, onBusy }: {
  initial: ItPhoneFormValues;
  /** When the line was added (read-only). */
  addedAt: string;
  people: { id: string; name: string }[];
  accounts: PhoneAccount[];
  phoneItems: { id: string; name: string; lineId: string | null }[];
  onSaved: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const h = usePhoneForm({ initial, accounts, phoneItems, onSaved });
  const { f, set, setF } = h;
  useEffect(() => { onBusy(h.saving); }, [h.saving, onBusy]);
  const secretHint = (saved: boolean | undefined) => (saved ? 'Saved. Type to replace.' : '');

  return (
    <form id={INLINE_FORM_ID} onSubmit={h.submit} className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Line details in the sheet's order */}
      <section aria-label="Line details" className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-primary-100 bg-primary-50 p-4 dark:border-primary-600 dark:bg-primary-700">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Box id="itp-number" label="Number*">
            <Input id="itp-number" required maxLength={40} autoFocus inputMode="tel" className={FORM_FIELD} value={f.number} onChange={e => set('number', e.target.value)} />
          </Box>
          <Box id="itp-mail" label="Mail">
            <Input id="itp-mail" type="email" maxLength={254} className={FORM_FIELD} value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@tlines.us" />
          </Box>
          <Box id="itp-password" label="Password">
            <Input id="itp-password" type="password" autoComplete="new-password" maxLength={200} className={FORM_FIELD} value={h.secrets.password}
              onChange={h.secret('password')} placeholder={secretHint(initial.hasSecret?.password)} />
          </Box>
          <Box id="itp-pin" label="PIN">
            <Input id="itp-pin" type="password" autoComplete="new-password" maxLength={200} inputMode="numeric" className={FORM_FIELD} value={h.secrets.pin}
              onChange={h.secret('pin')} placeholder={secretHint(initial.hasSecret?.pin)} />
          </Box>
        </div>

        {accounts.length > 0 && (
          <Box id="itp-same" label="Same account as">
            <Select id="itp-same" className={FORM_FIELD} value={h.accountFrom}
              options={[{ value: '', label: 'Keep as is' }, ...accounts.map(a => ({ value: a.lineId, label: accountLabel(a) }))]}
              onValueChange={v => h.pickAccount(v ?? '')} />
          </Box>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Box id="itp-carrier" label="Carrier">
            <Input id="itp-carrier" list="itp-carrier-list" maxLength={80} className={FORM_FIELD} value={f.carrier} onChange={e => set('carrier', e.target.value)} placeholder="T-Mobile" />
          </Box>
          <Box id="itp-firm" label="Firm Name">
            <Input id="itp-firm" list="itp-firm-list" maxLength={80} className={FORM_FIELD} value={f.firm} onChange={e => set('firm', e.target.value)} placeholder="T LINES LLC" />
          </Box>
          <Box id="itp-acc-holder" label="Account Holder">
            <Input id="itp-acc-holder" list="itp-acc-holder-list" maxLength={120} className={FORM_FIELD} value={f.accountHolder} onChange={e => set('accountHolder', e.target.value)} />
          </Box>
          <Box id="itp-accountNumber" label="Account No">
            <Input id="itp-accountNumber" type="password" autoComplete="new-password" maxLength={200} className={FORM_FIELD} value={h.secrets.accountNumber}
              onChange={h.secret('accountNumber')} placeholder={h.accountPlaceholder} />
          </Box>
        </div>
        <datalist id="itp-carrier-list">{h.suggest('carrier').map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="itp-firm-list">{h.suggest('firm').map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="itp-acc-holder-list">{h.suggest('accountHolder').map(v => <option key={v} value={v} />)}</datalist>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Box id="itp-imei" label="IMEI">
            <Input id="itp-imei" maxLength={40} inputMode="numeric" disabled={h.phoneMode === 'none'} className={FORM_FIELD} value={f.imei}
              onChange={e => set('imei', e.target.value)} placeholder={h.phoneMode === 'none' ? 'No phone' : '357716584828487'} />
          </Box>
          <Box id="itp-cost" label="Plan / Month (USD)">
            <Input id="itp-cost" type="number" min={0} max={100000} step="0.01" inputMode="decimal" className={FORM_FIELD} value={f.monthlyCost}
              onChange={e => set('monthlyCost', e.target.value)} placeholder="58.10" />
          </Box>
          <Box id="itp-loc" label="Location">
            <Select id="itp-loc" className={FORM_FIELD} value={f.location} options={LOCATION_OPTIONS} onValueChange={v => set('location', v ?? '')} />
          </Box>
          <div className="flex min-w-0 flex-col gap-[6px]">
            <span className={LABEL}>Added Date</span>
            <span className="flex h-[42px] items-center rounded-md border border-primary-100 bg-white/60 px-3 text-[14px] text-ui-body dark:border-transparent dark:bg-secondary-800/60">
              {formatTicketDate(addedAt)}
            </span>
          </div>
        </div>
        <Box id="itp-notes" label="Notes">
          <Textarea id="itp-notes" maxLength={4000} rows={2} className={FORM_TEXTAREA} value={f.notes} onChange={e => set('notes', e.target.value)} />
        </Box>
        <label className="flex items-center gap-2 text-[13px] text-ui-body">
          <Checkbox checked={!f.active} onCheckedChange={v => set('active', !v)} />
          Retired (move to History)
        </label>
      </section>

      {/* Who holds it, the phone it runs on */}
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[300px]">
        <div className={PANEL}>
          <Segmented id="itp-user-mode" label="Held by" value={h.holderMode} onChange={h.setHolderMode}
            options={[{ value: 'staff', label: 'Staff member' }, { value: 'name', label: 'Type a name' }]} />
          {h.holderMode === 'staff' ? (
            <Select id="itp-holder" aria-label="Staff member" className={FORM_FIELD} value={f.holderId} placeholder="Available (nobody)"
              options={[{ value: '', label: 'Available (nobody)' }, ...people.map(p => ({ value: p.id, label: p.name }))]}
              onValueChange={v => set('holderId', v ?? '')} />
          ) : (
            <Input aria-label="User's name" maxLength={120} className={FORM_FIELD} value={f.holderName}
              onChange={e => set('holderName', e.target.value)} placeholder="Full name (no account yet)" />
          )}
          <p className={cn('m-0 text-[11px]', STRONG)}>Since <span className="font-medium">{h.since(initial.holderSince, h.holderChanged, !!h.holderKey)}</span></p>
        </div>

        <div className={PANEL}>
          <Segmented id="itp-phone-mode" label="Phone" value={h.phoneMode} onChange={h.setPhoneMode}
            options={[{ value: 'company', label: 'Company' }, { value: 'personal', label: 'Personal' }, { value: 'none', label: 'None' }]} />
          {h.phoneMode === 'company' && (
            <>
              {phoneItems.length > 0 && (
                <Box id="itp-item" label="From the Items Library">
                  <Select id="itp-item" className={FORM_FIELD} value={f.itemId} options={h.libraryOptions}
                    onValueChange={v => {
                      const item = phoneItems.find(i => i.id === v);
                      setF(p => ({ ...p, itemId: v ?? '', deviceName: item ? item.name : p.itemId ? '' : p.deviceName }));
                    }} />
                </Box>
              )}
              <Box id="itp-device" label="Model*">
                <Input id="itp-device" maxLength={80} className={FORM_FIELD} value={f.deviceName} onChange={e => set('deviceName', e.target.value)}
                  placeholder="iPhone 12" readOnly={!!f.itemId} title={f.itemId ? 'The library item’s name' : undefined} />
              </Box>
              <Box id="itp-cond" label="Condition">
                <Select id="itp-cond" className={FORM_FIELD} value={f.deviceCondition} options={CONDITION_OPTIONS}
                  onValueChange={v => set('deviceCondition', (v ?? '') as ItPhoneFormValues['deviceCondition'])} />
              </Box>
              <p className={cn('m-0 text-[11px]', STRONG)}>Since <span className="font-medium">{h.since(initial.deviceAssignedAt, h.deviceChanged, !!h.deviceName)}</span></p>
            </>
          )}
        </div>
      </aside>
    </form>
  );
}
