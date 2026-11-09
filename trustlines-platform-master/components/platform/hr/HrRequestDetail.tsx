'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { CalendarDays, Check, Download, ExternalLink, FileText, Paperclip, X } from 'lucide-react';
import { PersonFace } from '@/components/ui/avatar-directory';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { HrRequest, HrRequestFile, HrRequestStatus } from './types';
import { PRIORITY, REASON, STATUS, initials, longDay, requestDays, shortDay } from './requestStyles';

// Figma "Requests" → request detail (node 565:17594): the request on the left with Reject /
// Approve and a decision note, the person and their leave numbers on the right, then the files
// that came with it. Deciding needs a choice first, then the note is saved with it.

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const NO_DATA = '—';

export interface HrRequestDetailProps {
  request: HrRequest | null;
  onOpenChange: (open: boolean) => void;
  /** Approved vacation days of this person among the known requests. */
  vacationDaysUsed: number;
  onDecide: (id: string, status: Exclude<HrRequestStatus, 'pending'>, note: string | null) => void;
}

export function HrRequestDetail({ request, onOpenChange, vacationDaysUsed, onDecide }: HrRequestDetailProps) {
  return (
    <DialogPrimitive.Root open={!!request} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1268px] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-[11px] bg-ui-page-bg p-5 font-ui text-ui-body shadow-04 outline-none transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 sm:p-8"
        >
          {request && <Body key={request.id} request={request} vacationDaysUsed={vacationDaysUsed} onDecide={onDecide} />}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Body({ request: r, vacationDaysUsed, onDecide }: { request: HrRequest; vacationDaysUsed: number; onDecide: HrRequestDetailProps['onDecide'] }) {
  const reason = REASON[r.reason];
  const priority = PRIORITY[r.priority];
  const ReasonIcon = reason.icon;
  const days = requestDays(r);
  const decided = r.status !== 'pending';
  const [choice, setChoice] = useState<Exclude<HrRequestStatus, 'pending'> | null>(decided ? r.status as Exclude<HrRequestStatus, 'pending'> : null);
  const [note, setNote] = useState(r.decisionNote ?? '');
  const noteId = useId();
  // Figma 570:19513: a rejection needs a reason ("Notes*"); an approval note is optional.
  const noteRequired = choice === 'rejected' && !decided;
  const canSubmit = !!choice && !decided && (!noteRequired || note.trim().length > 0);

  return (
    <>
      {/* ── Heading ── */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-col">
            <DialogPrimitive.Title className={cn('m-0 truncate text-[28px] font-semibold', HEADING)}>{r.name}</DialogPrimitive.Title>
            {r.role && <DialogPrimitive.Description className="m-0 text-[16px] text-ui-text-secondary">{r.role}</DialogPrimitive.Description>}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-[4px] py-0.5 pl-1.5 pr-2 text-[16px] font-medium leading-[1.4]" style={{ background: reason.bg, color: reason.fg }}>
              <ReasonIcon size={16} aria-hidden /> {reason.label}
            </span>
            <span className="rounded-[4px] px-2.5 py-0.5 text-[16px] font-medium leading-[1.4]" style={{ background: priority.bg, color: priority.fg }}>{priority.label}</span>
            {decided && (
              <span className="rounded-[4px] px-2.5 py-0.5 text-[16px] font-medium leading-[1.4]" style={{ background: STATUS[r.status as 'approved'].bg, color: STATUS[r.status as 'approved'].fg }}>
                {STATUS[r.status as 'approved' | 'rejected'].label}
              </span>
            )}
          </div>
        </div>
        <DialogPrimitive.Close aria-label="Close" className={cn('grid size-8 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent hover:bg-ui-hover-bg', HEADING)}>
          <X size={28} strokeWidth={1.5} />
        </DialogPrimitive.Close>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── Request + decision ── */}
        <div className="flex w-full flex-col gap-4 lg:w-[363px] lg:shrink-0">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <DayBox label="From:" iso={r.date} />
              <DayBox label="To:" iso={r.endDate} />
            </div>
            <div className="flex flex-col gap-2 rounded-[8px] px-4 py-6 leading-[1.45]" style={{ background: reason.bg, color: reason.fg }}>
              <div className="flex flex-col gap-1 font-semibold">
                <p className="m-0 text-[16px]">{reason.label} ({days} Day{days === 1 ? '' : 's'})</p>
                <p className="m-0 text-[13px]">{days === 1 ? `On ${longDay(r.date)}` : `From ${longDay(r.date)} - ${longDay(r.endDate)}`}</p>
              </div>
              {r.description && <p className="m-0 whitespace-pre-line text-[12px]">{r.description}</p>}
            </div>
            {choice ? (
              // Figma 570:18241: once chosen, the two actions become the outcome bar. Before the
              // decision is signed, clicking it goes back to Reject / Approve.
              <button
                type="button" disabled={decided} onClick={() => setChoice(null)}
                aria-label={decided ? STATUS[choice].label : `${STATUS[choice].label}. Change decision`}
                title={decided ? undefined : 'Change decision'}
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-[7px] rounded-[6px] border-0 pl-8 pr-6 text-[13px] font-medium transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring disabled:cursor-default disabled:hover:opacity-100"
                style={{ background: STATUS[choice].bg, color: STATUS[choice].fg }}
              >
                {STATUS[choice].label} {choice === 'approved' ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
              </button>
            ) : (
              <div className="flex gap-2" role="group" aria-label="Decision">
                <DecisionButton label="Reject" icon={X} className="bg-error-normal" onClick={() => setChoice('rejected')} />
                <DecisionButton label="Approve" icon={Check} className="bg-success-normal" onClick={() => setChoice('approved')} />
              </div>
            )}
          </div>

          <form
            onSubmit={e => { e.preventDefault(); if (canSubmit && choice) onDecide(r.id, choice, note.trim() || null); }}
            className="flex flex-col gap-4 rounded-[10px] border border-ui-divider bg-ui-page-bg p-6"
          >
            <label htmlFor={noteId} className={cn('text-[12px] font-medium leading-4', choice ? 'text-ui-body' : 'text-[var(--status-t0-bg)] dark:text-grey-700')}>
              Notes{noteRequired && <span aria-hidden>*</span>}
            </label>
            <textarea
              id={noteId} value={note} onChange={e => setNote(e.target.value)}
              disabled={!choice || decided} required={noteRequired} aria-required={noteRequired || undefined}
              placeholder={noteRequired ? 'Why is it rejected?' : 'type..'}
              className="h-[180px] w-full resize-none rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg p-3 text-[13px] leading-[1.5] text-ui-heading outline-none placeholder:text-primary-300 dark:placeholder:text-primary-400 disabled:placeholder:text-[var(--status-t0-bg)] dark:disabled:placeholder:text-grey-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:cursor-not-allowed disabled:border-[var(--status-t0-bg)] disabled:bg-ui-page-bg dark:disabled:border-grey-700"
            />
            <button
              type="submit" disabled={!choice || decided}
              className={cn(
                'h-10 w-full rounded-[6px] border-0 px-6 text-[13px] font-medium transition-opacity',
                !choice || decided
                  ? 'cursor-not-allowed bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)] dark:bg-grey-700'
                  : 'cursor-pointer bg-[var(--color-secondary-700)] text-white hover:opacity-90 dark:bg-primary-50 dark:text-primary-950',
              )}
            >
              {decided
                ? `${STATUS[r.status as 'approved' | 'rejected'].label}${r.decidedAt ? ` · ${new Date(r.decidedAt).toLocaleDateString('en-US')}` : ''}`
                : choice ? 'Sign and Submit' : 'Reject or approve first'}
            </button>
          </form>
        </div>

        {/* ── Person + files ── */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section aria-label="Staff member" className="flex flex-col gap-8 rounded-[8px] border border-ui-divider bg-ui-page-bg px-3.5 pb-6 pt-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="flex size-[53px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[var(--status-t0-fg)] text-[15px] font-semibold text-white dark:text-primary-950">
                  <PersonFace name={r.name} userId={r.userId} fallback={initials(r.name)} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={cn('truncate text-[20px] font-semibold tracking-[-0.44px]', HEADING)}>{r.name}</span>
                  {r.role && <span className="truncate text-[14px] tracking-[-0.308px] text-ui-text-secondary">{r.role}</span>}
                </span>
              </div>
              {r.userId && (
                <Link
                  href={`/team/${r.userId}`} aria-label={`Open ${r.name}'s profile`}
                  className="grid size-8 shrink-0 place-items-center rounded-[4px] bg-[var(--color-secondary-700)] text-white hover:opacity-90 dark:bg-primary-50 dark:text-primary-950"
                >
                  <ExternalLink size={20} strokeWidth={1.5} />
                </Link>
              )}
            </div>
            <dl className="m-0 grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-3">
              <Stat label="Vacation days Used" value={`${vacationDaysUsed} Day${vacationDaysUsed === 1 ? '' : 's'} Used`} />
              <Stat label="Vacation days Left" value={NO_DATA} />
              <Stat label="Extra Work Hours" value={NO_DATA} />
              <Stat label="Joined Date" value={r.joinedAt ? new Date(r.joinedAt).toLocaleDateString('en-US') : NO_DATA} />
              <Stat label="Birth Date" value={NO_DATA} />
            </dl>
          </section>

          <section aria-label="Attached files" className="flex flex-col gap-8 rounded-[8px] border border-ui-divider bg-ui-page-bg px-3.5 pb-6 pt-3.5">
            <h2 className={cn('m-0 text-[20px] font-semibold tracking-[-0.44px]', HEADING)}>Attached Files</h2>
            {r.files.length === 0 ? (
              <EmptyState size="sm" icon={<Paperclip />} title="No files attached." />
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {r.files.map(f => <li key={f.id}><FileCard file={f} /></li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function DayBox({ label, iso }: { label: string; iso: string }) {
  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-4 rounded-[6px] border border-ui-divider px-1.5 py-2', HEADING)}>
      <CalendarDays size={20} strokeWidth={1.5} aria-hidden className="shrink-0" />
      <span className="flex min-w-0 flex-col leading-normal">
        <span className="text-[10px]">{label}</span>
        <span className="truncate text-[13px] font-medium">{shortDay(iso)}</span>
      </span>
    </div>
  );
}

function DecisionButton({ label, icon: Icon, className, onClick }: {
  label: string; icon: typeof X; className: string; onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        'flex h-10 flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-[6px] border-0 pl-8 pr-6 text-[13px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring',
        className,
      )}
    >
      {label} <Icon size={16} aria-hidden />
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[12px] font-medium leading-4 text-ui-body">{label}</dt>
      <dd className={cn('m-0 truncate text-[14px] font-semibold leading-[1.5] tracking-[-0.308px]', HEADING)}>{value}</dd>
    </div>
  );
}

function FileCard({ file }: { file: HrRequestFile }) {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  return (
    <div className="flex flex-col overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
      <div className="flex h-[153px] items-center justify-center overflow-hidden border-b border-ui-divider bg-white">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" className="size-full object-cover object-top" />
        ) : isPdf ? (
          <object data={`${file.url}#toolbar=0&navpanes=0&view=FitH`} type="application/pdf" aria-label={file.name} className="pointer-events-none size-full">
            <FileText size={40} strokeWidth={1.25} className="text-ui-text-secondary" aria-hidden />
          </object>
        ) : (
          <FileText size={40} strokeWidth={1.25} className="text-ui-text-secondary" aria-hidden />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 bg-ui-surface px-2.5 py-1.5">
        <span className="flex min-w-0 flex-col leading-[1.3]">
          <span className={cn('truncate text-[13px] font-medium', HEADING)} title={file.name}>{file.name}</span>
          {file.label && <span className="truncate text-[11px] text-ui-text-secondary">{file.label}</span>}
        </span>
        <a
          href={file.url} download={file.name}
          className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] bg-[var(--color-secondary-700)] px-2.5 text-[11px] font-medium text-white no-underline hover:opacity-90 dark:bg-primary-50 dark:text-primary-950"
        >
          <Download size={14} aria-hidden /> Download
        </a>
      </div>
    </div>
  );
}
