'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ComponentType, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CalendarPlus, Copy, Lock, Mail, MapPin, Pencil, Phone, Smartphone, Trash2 } from 'lucide-react';
import { PersonFace } from '@/components/ui/avatar-directory';
import { cn } from '@/lib/utils';
import { formatTicketDate } from './ticketStyles';
import { MUTED, OUTLINE_CHIP, SOLID_CHIP, STRONG } from './itemStyles';
import { copyText, initials } from './itCardParts';

// Figma "Phone Numbers detail" (966:40115): Back, the number as the title, Delete / Edit Info; Basic
// Info (number, firm, mail, password, PIN, IMEI, start date, account number, location, added date, notes) on the
// left; who holds the line and the device it runs on on the right.
//
// Secrets (password, PIN, account number) are never part of the line: they are fetched one at a
// time through `onRevealSecret` (authorised and audited) when copied or shown. Until a data source
// exists, those controls and Delete / Edit Info are disabled.

export type ItPhoneSecret = 'password' | 'pin' | 'accountNumber';

export interface ItPhoneDetail {
  id: string;
  number: string;
  /** Carrier ("Firm" in the design), e.g. "T Mobile". */
  firm: string | null;
  email: string | null;
  imei: string | null;
  location: string | null;
  /** ISO date the line (contract) started. */
  startDate: string | null;
  /** ISO date. */
  addedAt: string | null;
  notes: string | null;
  holder: { id: string | null; name: string; role: string | null; acquiredAt: string | null } | null;
  /** Company device the line runs on; null = personal phone or none. */
  device: { name: string; imageUrl: string | null; assignedAt: string | null } | null;
}

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

const NOT_CONNECTED = 'Not available yet: the phone numbers data source is not connected';
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

export function ItPhoneDetailClient({ line, onRevealSecret }: {
  line: ItPhoneDetail | null;
  onRevealSecret?: (id: string, kind: ItPhoneSecret) => Promise<string>;
}) {
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
              disabled
              title={NOT_CONNECTED}
              className={cn('flex h-10 items-center gap-2 rounded-md border border-solid pl-3.5 pr-5 text-[13px] font-medium', DISABLED)}
              style={{ background: 'var(--status-t10-bg)', borderColor: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Delete
            </button>
            <button
              type="button"
              disabled
              title={NOT_CONNECTED}
              className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium', SOLID_CHIP, DISABLED)}
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Edit Info
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* Basic Info */}
        <section aria-labelledby="it-phone-basic" className={cn('flex min-w-0 flex-1 flex-col gap-4 px-5 pb-8 pt-4', PANEL)}>
          <h2 id="it-phone-basic" className={cn('m-0 text-[18px] font-semibold leading-normal', STRONG)}>Basic Info</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-[209px_143px_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Number" icon={Phone}>{line?.number ?? <Placeholder>—</Placeholder>}</Field>
            <Field label="Firm">{line?.firm ?? <Placeholder>—</Placeholder>}</Field>
            <Field label="Mail" icon={Mail} action={<CopyButton value={line?.email} what="Email" />}>
              {line?.email ?? <Placeholder>—</Placeholder>}
            </Field>
            <SecretField label="Password" icon={Lock} kind="password" lineId={line?.id ?? null} onReveal={onRevealSecret} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[213px_minmax(0,1fr)_minmax(0,1fr)]">
            <SecretField label="PIN" kind="pin" lineId={line?.id ?? null} onReveal={onRevealSecret} />
            <Field label="IMEI" action={<CopyButton value={line?.imei} what="IMEI" />}>{line?.imei ?? <Placeholder>—</Placeholder>}</Field>
            <Field label="Start Date" icon={CalendarPlus}>{formatTicketDate(line?.startDate ?? null)}</Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SecretField label="Account Number" kind="accountNumber" lineId={line?.id ?? null} onReveal={onRevealSecret} />
            <Field label="Location" icon={MapPin}>{line?.location ?? <Placeholder>—</Placeholder>}</Field>
            <Field label="Added Date" icon={CalendarPlus}>{formatTicketDate(line?.addedAt ?? null)}</Field>
          </div>
          <Field label="Notes">{line?.notes || <Placeholder>No notes</Placeholder>}</Field>
        </section>

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
                <p className="m-0 text-[12px] font-medium leading-[1.35]">{holder?.role ?? (line ? 'Available' : '—')}</p>
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
                {device?.name ?? 'No company phone'}
              </p>
              {device && (
                <p className={cn('m-0 text-[11px] leading-[1.35]', STRONG)}>
                  Assigned at: <span className="font-medium">{formatTicketDate(device.assignedAt)}</span>
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
