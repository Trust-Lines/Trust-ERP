'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Check, Download, ExternalLink, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/platform/shared/Avatar';
import { MonitorPcIcon } from './MonitorPcIcon';
import {
  CATEGORY_ICON,
  CATEGORY_TONE,
  NOT_CONNECTED_TITLE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  formatTicketDate,
  type ItTicketPriority,
  type ItTicketTone,
} from './ticketStyles';

// Figma "Ticket detail": 828:38141 (awaiting decision), 862:46860 (solved) and 862:47715 (not solved).
// Same layout; the decision row, the notes label and the submit button follow `resolution`.

export type ItTicketResolution = 'open' | 'solved' | 'not_solved';

export interface ItTicketAttachment {
  id: string;
  name: string;
  errorCode: string | null;
  /** Only set once the file endpoint exists; the button stays disabled without it. */
  downloadUrl: string | null;
}

export interface ItTicketDetailData {
  id: string;
  subject: string;
  /** ISO date the request was sent ("19 AUG 2026" under the subject). */
  createdAt: string;
  priority: ItTicketPriority;
  categoryLabel: string;
  categoryTone: ItTicketTone;
  requesterName: string;
  requesterRole: string;
  /** The request message shown in the tinted panel. */
  description: string;
  /** Requester contact and dates, shown in a 3-column grid. */
  details: { label: string; value: string | null }[];
  /** `open` until someone marks the request solved or not solved. */
  resolution: ItTicketResolution;
  attachments: ItTicketAttachment[];
}

const SECTION = 'flex flex-col gap-8 rounded-lg border border-solid border-primary-100 bg-white px-3.5 pb-6 pt-3.5 dark:border-primary-600 dark:bg-primary-800';
const FIELD_LABEL = 'm-0 text-[12px] font-medium leading-4 text-ui-body';
const FIELD_VALUE = 'm-0 text-[14px] font-semibold leading-[1.5] text-secondary-700 dark:text-primary-50';
const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-60';

function Placeholder({ children }: { children: ReactNode }) {
  return <span className="text-primary-300 dark:text-primary-400">{children}</span>;
}

function AttachmentCard({ file }: { file: ItTicketAttachment }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-solid border-primary-100 bg-white dark:border-primary-600">
      <div className="flex h-[153px] items-center justify-center border-b border-solid border-primary-100 bg-primary-50 text-primary-300 dark:border-primary-600 dark:bg-primary-900">
        <FileText className="h-10 w-10" strokeWidth={1.25} aria-hidden="true" />
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-solid border-primary-100 bg-[var(--color-ui-page-bg,#f0f2f5)] px-3 py-2 dark:border-primary-600">
        <div className="flex min-w-0 flex-col">
          <p className="m-0 truncate text-[12px] font-semibold text-secondary-700 dark:text-primary-50">{file.name}</p>
          <p className="m-0 text-[10px] tracking-[0.3px] text-ui-body">{file.errorCode ?? 'No error code'}</p>
        </div>
        <button
          type="button"
          disabled={!file.downloadUrl}
          title={file.downloadUrl ? undefined : NOT_CONNECTED_TITLE}
          aria-label={`Download ${file.name}`}
          className={cn('flex h-[27px] shrink-0 items-center gap-2 rounded bg-secondary-700 px-2 text-[11px] font-semibold text-white dark:bg-secondary-50 dark:text-primary-950', DISABLED)}
        >
          <Download className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Download
        </button>
      </div>
    </div>
  );
}

export function ItTicketDetailView({ ticket }: { ticket: ItTicketDetailData | null }) {
  const priorityTone = ticket ? PRIORITY_TONE[ticket.priority] : null;
  const categoryTone = ticket ? CATEGORY_TONE[ticket.categoryTone] : null;
  const CategoryIcon = ticket ? CATEGORY_ICON[ticket.categoryTone] : null;
  const resolution: ItTicketResolution = ticket?.resolution ?? 'open';
  const decided = resolution !== 'open';

  return (
    <div className="flex w-full flex-col gap-6 rounded-[11px] bg-white p-8 font-ui">
      {/* Heading: subject, date, chips on the left; close and "Access Computer" on the right. */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col leading-normal">
            <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-secondary-700 dark:text-primary-50">
              {ticket?.subject ?? <Placeholder>Ticket</Placeholder>}
            </h1>
            <p className="m-0 text-[16px] text-ui-body">{formatTicketDate(ticket?.createdAt ?? null)}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {ticket && categoryTone ? (
              <span className="flex items-center gap-2 rounded px-2 py-0.5 pl-1.5 text-[16px] font-medium leading-[1.4]" style={{ background: categoryTone.bg, color: categoryTone.fg }}>
                {CategoryIcon && <CategoryIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
                {ticket.categoryLabel}
              </span>
            ) : null}
            {ticket && priorityTone ? (
              <span className="rounded px-2.5 py-0.5 text-[16px] font-medium leading-[1.4]" style={{ background: priorityTone.bg, color: priorityTone.fg }}>
                {PRIORITY_LABEL[ticket.priority]}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex h-[92px] flex-col items-end justify-between">
          <Link
            href="/it/tickets"
            aria-label="Close ticket"
            className="grid h-8 w-8 place-items-center rounded text-secondary-700 hover:text-primary-500 dark:text-primary-50"
          >
            <X className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <button
            type="button"
            disabled
            title={NOT_CONNECTED_TITLE}
            className={cn('flex h-9 items-center gap-2 rounded-md bg-accent-400 pl-3 pr-4 text-[13px] font-semibold text-white', DISABLED)}
          >
            <MonitorPcIcon className="h-4 w-4" strokeWidth={2} />
            Access Computer
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Left: request message, decision, notes. */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[363px]">
          <div className="flex flex-col gap-2">
            <div className="rounded-lg bg-[var(--status-t9-bg)] px-4 pb-6 pt-4">
              <p className="m-0 text-[12px] leading-[1.45] text-[var(--status-t9-fg)]">
                {ticket?.description || <Placeholder>No request message</Placeholder>}
              </p>
            </div>
            {resolution === 'solved' ? (
              <div className="flex items-center justify-center gap-2 rounded-md bg-[var(--status-t9-bg)] px-6 py-2.5 text-[13px] font-medium text-[var(--status-t9-fg)]">
                Solved
                <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </div>
            ) : resolution === 'not_solved' ? (
              <div className="flex items-center justify-center gap-2 rounded-md bg-[var(--status-t10-bg)] px-6 py-2.5 text-[13px] font-medium text-[var(--status-t10-fg)]">
                Not Solved
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled
                  title={NOT_CONNECTED_TITLE}
                  className={cn('flex h-10 flex-1 items-center justify-center gap-2 rounded bg-[var(--color-error-normal)] px-6 text-[13px] font-medium text-white', DISABLED)}
                >
                  Mark Not solved
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled
                  title={NOT_CONNECTED_TITLE}
                  className={cn('flex h-10 flex-1 items-center justify-center gap-2 rounded bg-[var(--color-success-normal)] px-6 text-[13px] font-medium text-white', DISABLED)}
                >
                  Mark Solved
                  <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-[10px] border border-solid border-primary-100 bg-white p-6 dark:border-primary-600 dark:bg-primary-800">
            <label className="flex flex-col gap-4">
              <span className="text-[12px] font-medium leading-4 text-ui-body">
                {resolution === 'not_solved' ? 'Notes*' : 'Notes'}
              </span>
              <textarea
                disabled
                placeholder="type.."
                rows={8}
                className="h-[180px] w-full resize-none rounded-md border border-solid border-primary-300 bg-white p-3 text-[13px] text-secondary-700 placeholder:text-primary-300 disabled:cursor-not-allowed dark:border-primary-600 dark:bg-primary-800 dark:text-primary-50"
              />
            </label>
            <button
              type="button"
              disabled
              title={decided ? NOT_CONNECTED_TITLE : undefined}
              className={cn(
                'flex h-10 items-center justify-center rounded-md px-6 text-[13px] font-medium',
                decided ? 'bg-secondary-700 text-white dark:bg-secondary-50 dark:text-primary-950' : 'bg-primary-100 text-primary-500 dark:bg-primary-600 dark:text-primary-50',
                DISABLED,
              )}
            >
              {decided ? 'Sign and Submit' : 'Reject or approve first'}
            </button>
          </div>
        </div>

        {/* Right: requester card and attached files. */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className={SECTION}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {ticket ? (
                  <Avatar name={ticket.requesterName} size="lg" />
                ) : (
                  <span className="h-[53px] w-[53px] rounded bg-primary-50 dark:bg-primary-900" aria-hidden="true" />
                )}
                <div className="flex flex-col leading-normal">
                  <p className="m-0 text-[20px] font-semibold tracking-[-0.44px] text-secondary-700 dark:text-primary-50">
                    {ticket?.requesterName ?? <Placeholder>Requester</Placeholder>}
                  </p>
                  <p className="m-0 text-[14px] tracking-[-0.3px] text-ui-body">{ticket?.requesterRole ?? '—'}</p>
                </div>
              </div>
              <button
                type="button"
                disabled
                aria-label="Open requester profile"
                title={NOT_CONNECTED_TITLE}
                className={cn('grid h-8 w-8 shrink-0 place-items-center rounded bg-secondary-700 text-white dark:bg-secondary-50 dark:text-primary-950', DISABLED)}
              >
                <ExternalLink className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-3">
              {(ticket?.details ?? []).map(d => (
                <div key={d.label} className="flex min-w-0 flex-col gap-1">
                  <dt className={FIELD_LABEL}>{d.label}</dt>
                  <dd className={FIELD_VALUE}>{d.value ?? <Placeholder>—</Placeholder>}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={SECTION}>
            <h2 className="m-0 text-[16px] font-semibold leading-normal tracking-[-0.35px] text-secondary-700 dark:text-primary-50">Attached Files</h2>
            {ticket && ticket.attachments.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {ticket.attachments.map(file => (
                  <AttachmentCard key={file.id} file={file} />
                ))}
              </div>
            ) : (
              <p className="m-0 rounded-lg border border-dashed border-primary-300 px-4 py-10 text-center text-[13px] text-ui-body">
                No files attached.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
