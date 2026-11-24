'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ComponentType, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CalendarPlus, Copy, Lock, Mail, MapPin, Pencil, Phone, Smartphone, Trash2 } from 'lucide-react';
import { PersonFace } from '@/components/ui/avatar-directory';
import { cn } from '@/lib/utils';
import { formatTicketDate } from './ticketStyles';
import { MUTED, OUTLINE_CHIP, SOLID_CHIP, STRONG } from './itemStyles';
import { copyText, initials } from './itCardParts';
import { ConfirmModal } from '@/components/ui/modal';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { ItPhoneFormDialog, type ItPhoneFormValues } from './ItPhoneFormDialog';
import type { PhoneAccount } from '@/lib/it/phones';
import { AssignmentHistory, type AssignmentSpellView } from './AssignmentHistory';

// Figma "Phone Numbers detail" (966:40115): Back, the number as the title, Delete / Edit Info; Basic
// Info on the left in the order of the "Phones and sim cards info" sheet (number, mail, password,
// PIN, IMEI, carrier, firm, account holder, account no, plan, location, added date, notes); who
// holds the line and the device it runs on on the right.
//
// Secrets (password, PIN, account number) are never part of the line: they are fetched one at a
// time from /api/it/phones/[id]/secret (edit.it, audited) when copied or shown. Delete / Edit Info
// need edit.it too.

export type ItPhoneSecret = 'password' | 'pin' | 'accountNumber';

export interface ItPhoneDetail {
  id: string;
  number: string;
  carrier: string | null;
  /** e.g. "T LINES LLC". */
  firm: string | null;
  /** Name on the carrier account. */
  accountHolder: string | null;
  /** USD per month. */
  monthlyCost: number | null;
  /** The line runs on the holder's own phone. */
  personalDevice?: boolean;
  email: string | null;
  imei: string | null;
  location: string | null;
  /** ISO date. */
  addedAt: string | null;
  notes: string | null;
  /** id null = a typed name (no account yet). */
  holder: { id: string | null; name: string; role: string | null; acquiredAt: string | null } | null;
  /** Company device the line runs on; null = personal phone or none. */
  device: { name: string; imageUrl: string | null; assignedAt: string | null; condition?: 'new' | 'used' | null } | null;
}

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

const NOT_CONNECTED = 'Needs IT edit rights';
const MASK = '••••••••';
const PANEL = 'rounded-lg border border-solid border-primary-100 bg-primary-50 dark:border-primary-600 dark:bg-primary-700';
const BOX = cn(
  'flex min-h-[42px] min-w-0 items-center gap-1.5 rounded-md border border-solid border-primary-100 bg-white p-3 text-[14px] leading-[1.4] dark:border-transparent dark:bg-secondary-800',
  STRONG,
);
const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-60';
const COPY_BTN = cn('grid h-[23px] w-[23px] shrink-0 place-items-center rounded hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ui-focus-ring', DISABLED);

function Placeholder({ children }: { children: ReactNode }) {
  return <span className="text-primary-300 dark:text-primary-400">{children}</span>;
}

function Field({ label, icon: Icon, children, action }: { label: string; icon?: IconType; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[7px]">
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

/** A secret value: masked until revealed, fetched on demand through `onReveal`. */
function SecretField({ label, icon, kind, lineId, onReveal }: {
  label: string;
  icon?: IconType;
  kind: ItPhoneSecret;
  lineId: string | null;
  onReveal?: (id: string, kind: ItPhoneSecret) => Promise<string>;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const enabled = !!lineId && !!onReveal;

  async function load() {
    if (value) return value;
    if (!lineId || !onReveal) return null;
    setLoading(true);
    try { const v = await onReveal(lineId, kind); setValue(v); return v; }
    catch { toast.error(`Could not load the ${label.toLowerCase()}`); return null; }
    finally { setLoading(false); }
  }

  async function copy() {
    const v = await load();
    if (v) await copyText(v, label);
  }

  return (
    <Field
      label={label}
      icon={icon}
      action={
        <button type="button" onClick={copy} disabled={!enabled || loading} aria-label={`Copy ${label.toLowerCase()}`} title={enabled ? `Copy ${label.toLowerCase()}` : NOT_CONNECTED} className={COPY_BTN}>
          <Copy className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      }
    >
      {loading ? 'Loading…' : value ? (
        value
      ) : (
        <button type="button" onClick={() => void load()} disabled={!enabled} title={enabled ? `Show ${label.toLowerCase()}` : NOT_CONNECTED} className={cn('text-left', DISABLED)}>
          <span className="sr-only">Show {label.toLowerCase()}: </span>{MASK}
        </button>
      )}
    </Field>
  );
}

async function revealSecret(id: string, kind: ItPhoneSecret): Promise<string> {
  const res = await fetch(`/api/it/phones/${id}/secret?kind=${kind}`, { cache: 'no-store' });
  const b = await res.json().catch(() => null) as { value?: string; error?: string } | null;
  if (!res.ok || typeof b?.value !== 'string') throw new Error(b?.error ?? 'Could not load');
  return b.value;
}

export function ItPhoneDetailClient({ line, canEdit = false, editValues = null, people = [], history = [], accounts = [] }: {
  line: ItPhoneDetail | null;
  /** edit.it: Edit Info, Delete, reveal secrets. */
  canEdit?: boolean;
  /** The line as the edit form needs it. */
  editValues?: ItPhoneFormValues | null;
  people?: { id: string; name: string }[];
  /** Who held the line, and on which company phone (newest first). */
  history?: AssignmentSpellView[];
  /** Carrier accounts in use, for the form's "Same account as". */
  accounts?: PhoneAccount[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const onRevealSecret = canEdit && line ? revealSecret : undefined;
  const holder = line?.holder ?? null;
  const device = line?.device ?? null;

  return (
    <div className="flex w-full flex-col gap-6 p-7 font-ui lg:p-16">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <Link
          href="/it/phones"
          className={cn('flex h-7 items-center gap-1 self-start rounded-md pl-[13px] pr-4 text-[13px] font-semibold no-underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring', OUTLINE_CHIP)}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Back
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', STRONG)}>
            {line?.number ?? <Placeholder>Phone number</Placeholder>}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canEdit || !line}
              onClick={() => setDeleting(true)}
              title={canEdit ? undefined : NOT_CONNECTED}
              className={cn('flex h-10 items-center gap-2 rounded-md border border-solid pl-3.5 pr-5 text-[13px] font-medium', DISABLED)}
              style={{ background: 'var(--status-t10-bg)', borderColor: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Delete
            </button>
            <button
              type="button"
              disabled={!canEdit || !editValues}
              onClick={() => setEditing(true)}
              title={canEdit ? undefined : NOT_CONNECTED}
              className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium', SOLID_CHIP, DISABLED)}
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Edit Info
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/* Basic Info */}
        <section aria-labelledby="it-phone-basic" className={cn('flex min-w-0 flex-1 flex-col gap-4 px-5 pb-8 pt-4', PANEL)}>
          <h2 id="it-phone-basic" className={cn('m-0 text-[18px] font-semibold leading-normal', STRONG)}>Basic Info</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <Field label="Number" icon={Phone} action={<CopyButton value={line?.number} what="Number" />}>{line?.number ?? <Placeholder>—</Placeholder>}</Field>
            <Field label="Mail" icon={Mail} action={<CopyButton value={line?.email} what="Email" />}>
              {line?.email ?? <Placeholder>—</Placeholder>}
            </Field>
            <SecretField label="Password" icon={Lock} kind="password" lineId={line?.id ?? null} onReveal={onRevealSecret} />
            <SecretField label="PIN" kind="pin" lineId={line?.id ?? null} onReveal={onRevealSecret} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <Field label="Carrier">{line?.carrier ?? <Placeholder>—</Placeholder>}</Field>
            <Field label="Firm Name">{line?.firm ?? <Placeholder>—</Placeholder>}</Field>
            <Field label="Account Holder">{line?.accountHolder ?? <Placeholder>—</Placeholder>}</Field>
            <SecretField label="Account No" kind="accountNumber" lineId={line?.id ?? null} onReveal={onRevealSecret} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <Field label="IMEI" action={<CopyButton value={line?.imei} what="IMEI" />}>
              {line?.imei ?? <Placeholder>{line?.personalDevice ? 'Personal phone' : '—'}</Placeholder>}
            </Field>
            <Field label="Plan / Month">{line?.monthlyCost != null ? `${line.monthlyCost.toFixed(2)}` : <Placeholder>—</Placeholder>}</Field>
            <Field label="Location" icon={MapPin}>{line?.location ?? <Placeholder>—</Placeholder>}</Field>
            <Field label="Added Date" icon={CalendarPlus}>{formatTicketDate(line?.addedAt ?? null)}</Field>
          </div>
          <Field label="Notes">{line?.notes || <Placeholder>No notes</Placeholder>}</Field>
        </section>
        <AssignmentHistory spells={history} showDevice />
        </div>

        {/* Right column: who holds the line, the device it runs on */}
        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[366px]">
          <div
            className="flex items-center gap-2 rounded-[10px] border border-solid border-primary-100 p-3 text-secondary-50 dark:border-primary-600"
            style={{ backgroundImage: 'radial-gradient(circle at 22% 54%, rgba(31,37,45,0.2) 0%, rgba(120,136,161,0.2) 60%, transparent 61%), linear-gradient(90deg, #2b3d55 0%, #2b3d55 100%)' }}
          >
            <span className="grid size-[78px] shrink-0 place-items-center overflow-hidden rounded-lg bg-primary-950 text-[24px] font-semibold" aria-hidden="true">
              {holder ? <PersonFace name={holder.name} userId={holder.id} fallback={initials(holder.name) || '?'} /> : '?'}
            </span>
            <div className="flex min-h-[78px] min-w-0 flex-1 flex-col justify-between gap-2 self-stretch p-1">
              <div className="flex flex-col">
                <p className="m-0 truncate text-[24px] font-semibold leading-normal">{holder?.name ?? 'Not assigned'}</p>
                <p className="m-0 text-[12px] font-medium leading-[1.35]">{holder ? (holder.role ? roleLabel(holder.role) : holder.id ? '—' : 'No account yet') : line ? 'Available' : '—'}</p>
              </div>
              {holder && (
                <p className="m-0 text-[11px] leading-[1.35]">
                  Acquired at: <span className="font-medium">{formatTicketDate(holder.acquiredAt)}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-[10px] border border-solid border-primary-100 bg-primary-50 p-3 dark:border-primary-600 dark:bg-primary-700">
            <span className="relative grid size-[78px] shrink-0 place-items-center overflow-hidden rounded-lg bg-white dark:bg-secondary-800">
              {device?.imageUrl ? (
                <Image src={device.imageUrl} alt="" fill unoptimized sizes="78px" className="object-cover" />
              ) : (
                <Smartphone className="h-8 w-8 text-primary-300" strokeWidth={1.25} aria-hidden="true" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 self-stretch p-1">
              <p className={cn('m-0 truncate text-[24px] font-semibold leading-normal', device ? STRONG : MUTED)}>
                {device?.name ?? (line?.personalDevice ? 'Personal phone' : 'No company phone')}
              </p>
              {device && (
                <p className={cn('m-0 text-[11px] leading-[1.35]', STRONG)}>
                  Assigned at: <span className="font-medium">{formatTicketDate(device.assignedAt)}</span>
                  {device.condition && <> · <span className="font-medium">{device.condition === 'used' ? 'Used' : 'New'}</span></>}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {editing && editValues && (
        <ItPhoneFormDialog initial={editValues} people={people} accounts={accounts} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); router.refresh(); }} />
      )}
      <ConfirmModal
        open={deleting} onOpenChange={setDeleting} tone="destructive" confirmLabel="Delete number"
        title={`Delete ${line?.number ?? 'this number'}?`}
        warning="The line and its saved account details are removed from the IT list. To keep it on record, mark it Retired in Edit Info instead."
        onConfirm={async () => {
          if (!line) return;
          const res = await fetch(`/api/it/phones/${line.id}`, { method: 'DELETE' });
          if (!res.ok) { toast.error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not delete'); throw new Error('kept'); }
          toast.success('Number deleted');
          router.push('/it/phones');
          router.refresh();
        }}
      />
    </div>
  );
}
