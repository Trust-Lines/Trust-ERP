'use client';

import { useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Check, ExternalLink, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';
import { feedback } from '@/components/ui/feedback-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Figma "Approvals" request pop-up (481:23498 scrim + 481:23499): heading with chips and close, then
// [file card with Reject / Approve] + [Notes with the confirm button] on the left, File Preview on the right.
// Same API as ApprovalActionBar: POST /api/projects/:id/doc-approvals { action, approvalId, notes }.
// Notes are only sent (and required) for a rejection, so the box opens once "Reject" is picked.

export interface ReviewApproval {
  approvalId: string; projectId: string; fileName: string;
  isFinalStage: boolean; versionNum: number | null; version: number;
  stage: number; totalStages: number; stageLabel: string;
}

interface Props {
  subtitle: string;
  title: string;
  chips: React.ReactNode;
  /** Real approval; null for a sample row (read-only details instead of actions). */
  approval: ReviewApproval | null;
  previewUrl: string | null;
  uploadedLabel: string;
  details?: { label: string; value: string }[];
  userSignature: string | null | undefined;
  onNeedSignature: (resume: () => void) => void;
  onPdfSigned: () => void;
  onDone: () => void;
  onClose: () => void;
}

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const SURFACE = 'flex flex-col rounded-[10px] border border-ui-divider bg-ui-page-bg p-6';
const kind = (name: string): 'pdf' | 'image' | 'sheet' | 'other' => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  return 'other';
};

export function ApprovalReviewDialog(p: Props) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const a = p.approval;

  async function submit(signed = false) {
    if (!a || !decision) return;
    // Resumed after the signature pad saved: the prop is still the old null here, so skip the check.
    if (decision === 'approve' && p.userSignature === null && !signed) {
      p.onNeedSignature(() => void submit(true));
      return;
    }
    setActing(true);
    try {
      const res = await fetch(`/api/projects/${a.projectId}/doc-approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, approvalId: a.approvalId, notes: decision === 'reject' ? note : undefined }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(e.error ?? 'Failed');
      }
      const json = await res.json() as { signatureApplied?: boolean; nextVersionOpened?: number | null };
      if (decision === 'approve') {
        feedback.success('Approved', {
          description: json.signatureApplied ? 'Your signature was stamped on the PDF.' : `Version ${a.versionNum ?? a.version} is approved.`,
          action: { label: 'View project', href: `/projects/${a.projectId}` },
        });
        if (json.signatureApplied) p.onPdfSigned();
      } else if (json.nextVersionOpened != null) {
        toast.success(`Rejected — V${json.nextVersionOpened} folder opened in Dropbox for the revision`, { duration: 7000 });
      } else {
        toast.success('Rejected');
      }
      p.onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  }

  const ready = decision === 'approve' || (decision === 'reject' && note.trim().length > 0);
  // Figma 481:23893 (decision picked): "Sign and Submit". A rejection carries no signature, so it reads "Submit".
  const submitLabel = acting ? 'Saving…'
    : decision === 'approve' ? 'Sign and Submit'
    : decision === 'reject' ? (note.trim() ? 'Submit' : 'Add a reason to reject')
    : 'Reject or approve first';
  const FileIcon = a ? ({ pdf: FileText, image: ImageIcon, sheet: FileSpreadsheet, other: FileText } as const)[kind(a.fileName)] : FileText;

  return (
    <DialogPrimitive.Root open onOpenChange={o => { if (!o) p.onClose(); }}>
      <DialogPrimitive.Portal>
        {/* Figma 481:23498 "Drawer scrim": black at 70%. */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1268px] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-[11px] bg-ui-page-bg p-4 font-[family-name:var(--font-ui)] shadow-04 outline-none transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 sm:p-8"
        >
          {/* Heading */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 flex-col">
                <DialogPrimitive.Description className="m-0 truncate text-[16px] text-ui-text-secondary">{p.subtitle}</DialogPrimitive.Description>
                <DialogPrimitive.Title className={cn('m-0 text-[22px] font-semibold leading-[1.25] sm:text-[28px]', HEADING)}>{p.title}</DialogPrimitive.Title>
              </div>
              <div className="flex flex-wrap items-start gap-[5px]">{p.chips}</div>
            </div>
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-md" aria-label="Close" className={cn('-mr-1 shrink-0 [&_svg]:size-8', HEADING)} />}>
              <X strokeWidth={1.5} />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-4 lg:min-h-[560px] lg:flex-row lg:items-stretch">
            {/* Left column */}
            <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[363px]">
              <section className={cn(SURFACE, 'gap-8')}>
                <div className="flex items-center gap-3">
                  <FileIcon className="size-[22px] shrink-0 text-ui-body" aria-hidden />
                  <div className="flex min-w-0 flex-col gap-1 leading-[1.45]">
                    <span className="truncate text-[13px] font-medium text-ui-body" title={a?.fileName}>{a?.fileName ?? 'No file attached'}</span>
                    <span className="text-[12px] text-ui-text-secondary">
                      {a ? `V${a.version} · Stage ${a.stage} of ${a.totalStages} · Uploaded ${p.uploadedLabel}` : p.uploadedLabel}
                    </span>
                  </div>
                </div>

                {a ? (
                  <div className="flex flex-col gap-3">
                    {decision ? (
                      // Figma 481:24218: once picked, one tinted "Rejected ✕" / "Approved ✓" bar; clicking it undoes the pick.
                      <button
                        type="button" disabled={acting} onClick={() => { setDecision(null); setNote(''); }}
                        aria-label={`${decision === 'reject' ? 'Rejected' : 'Approved'} — click to change the decision`}
                        title="Change decision"
                        className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-[7px] rounded-[6px] border-0 pl-8 pr-6 text-[13px] font-medium transition-opacity hover:opacity-85 disabled:cursor-not-allowed"
                        style={decision === 'reject'
                          ? { background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }
                          : { background: 'var(--status-t9-bg)', color: 'var(--status-t9-fg)' }}
                      >
                        {decision === 'reject' ? <>Rejected <X className="size-4" aria-hidden /></> : <>Approved <Check className="size-4" aria-hidden /></>}
                      </button>
                    ) : (
                      <div className="flex gap-2" role="group" aria-label="Decision">
                        <button
                          type="button" disabled={acting} onClick={() => setDecision('reject')}
                          className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-[6px] border-0 bg-error-normal text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
                        >
                          Reject <X className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button" disabled={acting} onClick={() => setDecision('approve')}
                          className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-[6px] border-0 bg-success-normal text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
                        >
                          Approve <Check className="size-4" aria-hidden />
                        </button>
                      </div>
                    )}
                    {p.userSignature === null && (
                      <p className="m-0 text-[11px] text-ui-text-secondary">✍️ You&apos;ll draw your signature before approving.</p>
                    )}
                    {p.userSignature && (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.userSignature} alt="Your signature" className="h-6 max-w-[110px] rounded-[3px] border border-ui-divider bg-white object-contain px-1" />
                        <span className="text-[11px] text-ui-text-secondary">will be stamped on the PDF</span>
                      </div>
                    )}
                    <a href={`/projects/${a.projectId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start text-[12px] font-medium text-ui-nav-active no-underline hover:underline">
                      Open in project <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </div>
                ) : p.details && (
                  <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
                    {p.details.map(d => (
                      <div key={d.label} className="flex min-w-0 flex-col gap-0.5">
                        <dt className="text-[12px] text-ui-text-secondary">{d.label}</dt>
                        <dd className="m-0 truncate text-[13px] font-medium text-ui-body">{d.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              {a && (
                <section className={cn(SURFACE, 'gap-4')}>
                  <label className="flex flex-col gap-4">
                    <span className={cn('text-[12px] font-medium leading-4', decision ? 'text-ui-body' : 'text-ui-text-secondary')}>
                      {decision === 'reject' ? 'Notes*' : 'Notes'}
                    </span>
                    <textarea
                      value={note} onChange={e => setNote(e.target.value)} disabled={decision !== 'reject' || acting}
                      required={decision === 'reject'} aria-required={decision === 'reject'}
                      placeholder={decision === 'reject' ? 'Reason for rejection…' : decision === 'approve' ? 'Notes are only saved with a rejection' : 'type..'}
                      className={cn(
                        'h-[180px] w-full resize-none rounded-[6px] border p-3 text-[13px] text-ui-heading outline-none placeholder:text-[11px] placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:cursor-not-allowed',
                        decision ? 'border-ui-input-border bg-ui-input-bg' : 'border-ui-divider bg-ui-page-bg',
                      )}
                    />
                  </label>
                  {decision === 'reject' && a.isFinalStage && (
                    <p className="m-0 rounded-[6px] px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}>
                      Final-stage rejection opens the next version{a.versionNum != null ? ` (V${a.versionNum + 1})` : ''} for the whole document set.
                    </p>
                  )}
                  <button
                    type="button" onClick={() => void submit()} disabled={!ready || acting}
                    className={cn(
                      'inline-flex h-9 w-full items-center justify-center gap-2 rounded-[6px] border-0 px-6 text-[13px] font-medium transition-opacity',
                      // Figma 481:24230: primary navy (near-white in dark) once a decision can be submitted.
                      ready && !acting
                        ? 'cursor-pointer bg-[var(--color-secondary-700)] text-white hover:opacity-90 dark:bg-primary-50 dark:text-primary-950'
                        : 'cursor-not-allowed',
                    )}
                    style={ready && !acting ? undefined : { background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}
                  >
                    {acting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    {submitLabel}
                  </button>
                </section>
              )}
            </div>

            {/* File preview — Figma 481:23542: light surface in light mode, page background (just the border) in dark. */}
            <section className="flex min-h-[420px] min-w-0 flex-1 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface p-5 dark:bg-ui-page-bg">
              <h3 className={cn('m-0 text-[20px] font-semibold leading-[1.45]', HEADING)}>File Preview</h3>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[6px]">
                {a && p.previewUrl && kind(a.fileName) === 'pdf' ? (
                  <iframe key={p.previewUrl} src={p.previewUrl} title={a.fileName} className="size-full min-h-[520px] rounded-[6px] border-0 bg-white" />
                ) : a && p.previewUrl && kind(a.fileName) === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.previewUrl} src={p.previewUrl} alt={a.fileName} className="max-h-[560px] max-w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-8 text-center text-[20px] font-medium leading-[1.45] text-ui-body">
                    <Maximize2 className="size-5" aria-hidden />
                    {a ? 'Preview not available — open in project to view the file.' : 'No file to preview'}
                  </div>
                )}
              </div>
            </section>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
