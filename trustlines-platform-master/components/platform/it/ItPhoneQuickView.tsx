'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowRight, CalendarPlus, Check, Copy, Lock, Mail, MapPin, Pencil, Phone, Smartphone, Trash2, X } from 'lucide-react';
import { ModalPanel } from '@/components/ui/modal';
import { PersonFace } from '@/components/ui/avatar-directory';
import { cn } from '@/lib/utils';
import type { PhoneLineData } from '@/lib/it/phones';
import { formatTicketDate } from './ticketStyles';
import { MUTED, SOLID_CHIP, STRONG } from './itemStyles';
import { copyText, initials } from './itCardParts';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import type { ItPhoneFormValues } from './ItPhoneFormDialog';
import { INLINE_FORM_ID, ItPhoneInlineEdit } from './ItPhoneInlineEdit';
import type { PhoneAccount } from '@/lib/it/phones';
import { AssignmentHistory, type AssignmentSpellView } from './AssignmentHistory';

// IT → Phone Numbers: one line in a pop-up (instead of its own page), opened from its card or a
// link (?line=<id>). Same content as the sheet: number, mail, password, PIN / carrier, firm,
// account holder, account no / IMEI, plan, location, added date, notes; who holds it and the phone
// it runs on (linked to the Items Library); and its assignment history, fetched when it opens.
// Edit Info turns the same boxes into inputs, in the same layout (ItPhoneInlineEdit); Save / Cancel go back.
//
// Secrets are never part of the line: fetched one at a time from /api/it/phones/[id]/secret
// (edit.it, audited) when shown or copied.

export type ItPhoneSecret = 'password' | 'pin' | 'accountNumber';
/** A library phone: its name, photo and the line it runs (null = free). */
export interface PhoneItemOption { id: string; name: string; lineId: string | null; imageUrl?: string | null }

const NOT_CONNECTED = 'Needs IT edit rights';
const MASK = '••••••••';
const BOX = cn(
  'flex min-h-[40px] min-w-0 items-center gap-1.5 rounded-md border border-solid border-primary-100 bg-white px-3 py-2 text-[14px] leading-[1.4] dark:border-transparent dark:bg-secondary-800',
  STRONG,
);
const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-60';
const COPY_BTN = cn('grid h-[23px] w-[23px] shrink-0 place-items-center rounded hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ui-focus-ring', DISABLED);

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

function Placeholder({ children }: { children: ReactNode }) {
  return <span className="text-primary-300 dark:text-primary-400">{children}</span>;
}

function Field({ label, icon: Icon, children, action }: { label: string; icon?: IconType; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      <span className="text-[12px] font-medium leading-4 text-ui-body">{label}</span>
      <div className={BOX}>
        {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {action}
      </div>
    </div>
  );
}

function CopyButton({ value, what }: { value: string | null | undefined; what: string }) {
  return (
    <button type="button" disabled={!value} onClick={() => value && void copyText(value, what)} aria-label={`Copy ${what.toLowerCase()}`} className={COPY_BTN}>
      <Copy className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

async function revealSecret(id: string, kind: ItPhoneSecret): Promise<string> {
  const res = await fetch(`/api/it/phones/${id}/secret?kind=${kind}`, { cache: 'no-store' });
  const b = await res.json().catch(() => null) as { value?: string; error?: string } | null;
  if (!res.ok || typeof b?.value !== 'string') throw new Error(b?.error ?? 'Could not load');
  return b.value;
}

/** A secret value: masked until shown, fetched on demand. */
function SecretField({ label, icon, kind, lineId, saved, canReveal }: {
  label: string; icon?: IconType; kind: ItPhoneSecret; lineId: string; saved: boolean; canReveal: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const enabled = canReveal && saved;

  async function load() {
    if (value) return value;
    if (!enabled) return null;
    setLoading(true);
    try { const v = await revealSecret(lineId, kind); setValue(v); return v; }
    catch { toast.error(`Could not load the ${label.toLowerCase()}`); return null; }
    finally { setLoading(false); }
  }

  return (
    <Field
      label={label} icon={icon}
      action={
        <button type="button" onClick={async () => { const v = await load(); if (v) await copyText(v, label); }} disabled={!enabled || loading}
          aria-label={`Copy ${label.toLowerCase()}`} title={!canReveal ? NOT_CONNECTED : saved ? `Copy ${label.toLowerCase()}` : 'Nothing saved'} className={COPY_BTN}>
          <Copy className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      }
    >
      {loading ? 'Loading…' : value ? value : !saved ? <Placeholder>—</Placeholder> : (
        <button type="button" onClick={() => void load()} disabled={!enabled} title={enabled ? `Show ${label.toLowerCase()}` : NOT_CONNECTED} className={cn('text-left', DISABLED)}>
          <span className="sr-only">Show {label.toLowerCase()}: </span>{MASK}
        </button>
      )}
    </Field>
  );
}

/** The line as the edit form needs it. */
export function phoneFormValues(l: PhoneLineData): ItPhoneFormValues {
  return {
    id: l.id, number: l.number, carrier: l.carrier ?? '', firm: l.firm ?? '', accountHolder: l.accountHolder ?? '',
    monthlyCost: l.monthlyCost != null ? l.monthlyCost.toFixed(2) : '',
    holderId: l.holderId ?? '', holderName: l.holderId ? '' : l.holderName ?? '',
    deviceName: l.deviceName ?? '', personalDevice: l.personalDevice, deviceCondition: l.deviceCondition ?? '', itemId: l.itemId ?? '',
    email: l.email ?? '', imei: l.imei ?? '', location: l.location ?? '', notes: l.notes ?? '',
    active: l.active, hasSecret: l.hasSecret, holderSince: l.holderSince, deviceAssignedAt: l.deviceAssignedAt,
  };
}

export function ItPhoneQuickView({ line, item, canEdit, people, accounts, phoneItems, onClose, onSaved, onDelete }: {
  line: PhoneLineData;
  /** The Items Library phone it runs on, if linked. */
  item: PhoneItemOption | null;
  /** edit.it: Edit Info, Delete, reveal secrets. */
  canEdit: boolean;
  /** For the form (edit.it). */
  people: { id: string; name: string }[];
  accounts: PhoneAccount[];
  phoneItems: PhoneItemOption[];
  onClose: () => void;
  /** Saved from the in-place form: refresh the list. */
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<AssignmentSpellView[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/it/phones/${line.id}/history`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { spells: [] }))
      .then((b: { spells?: AssignmentSpellView[] }) => { if (live) setHistory(b.spells ?? []); })
      .catch(() => { if (live) setHistory([]); });
    return () => { live = false; };
  }, [line.id]);

  const free = !line.holderName;
  const deviceName = item?.name ?? line.deviceName;

  return (
    <ModalPanel onOpenChange={o => { if (!o && !busy) onClose(); }} aria-label={`Phone number ${line.number}`} containerClassName="items-start overflow-y-auto px-4 py-[4vh]">
      <div
        onClick={e => e.stopPropagation()}
        className="mx-auto flex w-[min(1040px,100%)] flex-col gap-5 rounded-[16px] border border-ui-divider bg-ui-surface-elevated p-5 font-ui shadow-[0_12px_48px_rgba(0,0,0,0.25)]"
      >
        {/* Heading: number, status, actions */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cn('m-0 text-[26px] font-semibold leading-[1.3] tracking-[0.5px]', STRONG)}>{line.number}</h2>
              <CopyButton value={line.number} what="Number" />
              {!line.active && <span className="rounded-[4px] bg-primary-100 px-2 py-0.5 text-[12px] font-semibold text-secondary-700 dark:bg-primary-600 dark:text-secondary-50">Retired</span>}
              {line.active && free && <span className="rounded-[4px] bg-[var(--status-t9-bg)] px-2 py-0.5 text-[12px] font-semibold text-[var(--status-t9-fg)]">Available</span>}
            </div>
            <p className="m-0 text-[13px] text-ui-body">{[line.carrier, line.firm].filter(Boolean).join(' · ') || 'No carrier yet'}</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <>
                <button type="button" onClick={onDelete}
                  className="flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium hover:opacity-90"
                  style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Delete
                </button>
                <button type="button" onClick={() => setEditing(true)} className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium hover:opacity-90', SOLID_CHIP)}>
                  <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Edit Info
                </button>
              </>
            )}
            {editing && (
              <>
                <button type="button" onClick={() => setEditing(false)} disabled={busy}
                  className={cn('flex h-10 items-center gap-2 rounded-md border border-ui-divider pl-3.5 pr-5 text-[13px] font-medium hover:bg-ui-hover-bg disabled:opacity-60', STRONG)}>
                  Cancel
                </button>
                <button type="submit" form={INLINE_FORM_ID} disabled={busy}
                  className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium hover:opacity-90 disabled:opacity-60', SOLID_CHIP)}>
                  <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> {busy ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
              className={cn('grid size-10 place-items-center rounded-md border border-ui-divider hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring', STRONG)}>
              <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        {editing ? (
          <ItPhoneInlineEdit
            initial={phoneFormValues(line)} addedAt={line.createdAt} people={people} accounts={accounts} phoneItems={phoneItems}
            onBusy={setBusy} onSaved={() => { setEditing(false); onSaved(); }}
          />
        ) : (<>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* Line details in the sheet's order */}
          <section aria-label="Line details" className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-primary-100 bg-primary-50 p-4 dark:border-primary-600 dark:bg-primary-700">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Number" icon={Phone} action={<CopyButton value={line.number} what="Number" />}>{line.number}</Field>
              <Field label="Mail" icon={Mail} action={<CopyButton value={line.email} what="Email" />}>{line.email ?? <Placeholder>—</Placeholder>}</Field>
              <SecretField label="Password" icon={Lock} kind="password" lineId={line.id} saved={line.hasSecret.password} canReveal={canEdit} />
              <SecretField label="PIN" kind="pin" lineId={line.id} saved={line.hasSecret.pin} canReveal={canEdit} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Carrier">{line.carrier ?? <Placeholder>—</Placeholder>}</Field>
              <Field label="Firm Name">{line.firm ?? <Placeholder>—</Placeholder>}</Field>
              <Field label="Account Holder">{line.accountHolder ?? <Placeholder>—</Placeholder>}</Field>
              <SecretField label="Account No" kind="accountNumber" lineId={line.id} saved={line.hasSecret.accountNumber} canReveal={canEdit} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="IMEI" action={<CopyButton value={line.imei} what="IMEI" />}>
                {line.imei ?? <Placeholder>{line.personalDevice ? 'Personal phone' : '—'}</Placeholder>}
              </Field>
              <Field label="Plan / Month">{line.monthlyCost != null ? `$${line.monthlyCost.toFixed(2)}` : <Placeholder>—</Placeholder>}</Field>
              <Field label="Location" icon={MapPin}>{line.location ?? <Placeholder>—</Placeholder>}</Field>
              <Field label="Added Date" icon={CalendarPlus}>{formatTicketDate(line.createdAt)}</Field>
            </div>
            <Field label="Notes"><span className="whitespace-pre-wrap">{line.notes || <Placeholder>No notes</Placeholder>}</span></Field>
          </section>

          {/* Who holds it, the phone it runs on */}
          <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[300px]">
            <div
              className="flex items-center gap-2 rounded-[10px] p-3 text-secondary-50"
              style={{ backgroundImage: 'radial-gradient(circle at 22% 54%, rgba(31,37,45,0.2) 0%, rgba(120,136,161,0.2) 60%, transparent 61%), linear-gradient(90deg, #2b3d55 0%, #2b3d55 100%)' }}
            >
              <span className="grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-lg bg-primary-950 text-[20px] font-semibold" aria-hidden="true">
                {line.holderName ? <PersonFace name={line.holderName} userId={line.holderId} fallback={initials(line.holderName) || '?'} /> : '?'}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {line.holderId ? (
                  <Link href={`/it/staff/${line.holderId}`} className="truncate text-[18px] font-semibold text-inherit no-underline hover:underline">{line.holderName}</Link>
                ) : (
                  <p className="m-0 truncate text-[18px] font-semibold">{line.holderName ?? 'Not assigned'}</p>
                )}
                <p className="m-0 text-[12px] font-medium leading-[1.35]">
                  {line.holderName ? (line.holderRole ? roleLabel(line.holderRole) : line.holderId ? '—' : 'No account yet') : 'Available'}
                </p>
                {line.holderName && <p className="m-0 text-[11px]">Since <span className="font-medium">{formatTicketDate(line.holderSince)}</span></p>}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-[10px] border border-primary-100 bg-primary-50 p-3 dark:border-primary-600 dark:bg-primary-700">
              <span className="relative grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-lg bg-white dark:bg-secondary-800">
                {item?.imageUrl ? (
                  <Image src={item.imageUrl} alt="" fill unoptimized sizes="60px" className="object-contain p-1" />
                ) : (
                  <Smartphone className="h-7 w-7 text-primary-300" strokeWidth={1.25} aria-hidden="true" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className={cn('m-0 truncate text-[18px] font-semibold', deviceName ? STRONG : MUTED)}>
                  {deviceName ?? (line.personalDevice ? 'Personal phone' : 'No company phone')}
                </p>
                {deviceName && (
                  <p className={cn('m-0 text-[11px]', STRONG)}>
                    Since <span className="font-medium">{formatTicketDate(line.deviceAssignedAt)}</span>
                    {line.deviceCondition && <> · <span className="font-medium">{line.deviceCondition === 'used' ? 'Used' : 'New'}</span></>}
                  </p>
                )}
                {item && (
                  <Link href={`/it/items/${item.id}`} className={cn('inline-flex items-center gap-1 self-start text-[12px] font-semibold no-underline hover:underline', STRONG)}>
                    Open in Items Library <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </div>

        {history === null ? (
          <p className="m-0 text-[13px] text-ui-body" role="status">Loading assignment history…</p>
        ) : (
          <AssignmentHistory spells={history} showDevice />
        )}
        </>)}
      </div>
    </ModalPanel>
  );
}
