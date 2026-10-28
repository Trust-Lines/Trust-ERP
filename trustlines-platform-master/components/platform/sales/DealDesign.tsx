'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FolderOpen, Link2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/formatDate';

interface DealDesignJob {
  id: string; title: string; status: string; priority: string; due_date: string | null;
  designer: string | null; folder: string | null; sharedUrl: string | null;
  latestVersion: { version_no: number; status: string } | null;
}

const VERSION_LABEL: Record<string, string> = {
  draft: 'draft', submitted: 'waiting for your review', presented: 'with the customer',
  approved: 'approved', revision_requested: 'in revision', rejected: 'rejected',
};

/**
 * The deal panel's "Design" card: where the design stands, and the Dropbox design folder the
 * designer works in — shared with Sales so the proposal can go to the customer from here.
 * People without Sales access (Marketing) get a one-line note instead.
 */
export function DealDesign({ opportunityId, leadId }: { opportunityId?: string; leadId?: string }) {
  const [job, setJob] = useState<DealDesignJob | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false); // no Sales access (e.g. Marketing)
  const query = opportunityId ? `opportunityId=${opportunityId}` : `leadId=${leadId}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/design-jobs/lookup?${query}`).catch(() => null);
    if (res && (res.status === 401 || res.status === 403)) { setHidden(true); return; }
    if (!res?.ok) { setJob(null); return; }
    const b = await res.json().catch(() => ({}));
    setJob(b.job ?? null);
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  async function folderLink() {
    if (!job) return;
    if (job.sharedUrl) { window.open(job.sharedUrl, '_blank', 'noopener,noreferrer'); return; }
    const win = window.open('', '_blank');
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${job.id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share' }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok || !b.url) { win?.close(); toast.error(b.error ?? 'Could not open the design folder'); return; }
      setJob({ ...job, sharedUrl: b.url });
      if (win) win.location.href = b.url; else window.open(b.url, '_blank', 'noopener,noreferrer');
    } finally { setBusy(false); }
  }

  async function copyLink() {
    if (!job?.sharedUrl) return;
    try { await navigator.clipboard.writeText(job.sharedUrl); toast.success('Design folder link copied'); }
    catch { toast.success(job.sharedUrl); }
  }

  if (hidden) return <p className="m-0 text-[12px] text-ui-text-secondary">Design is handled by Sales and the design team.</p>;
  if (job === undefined) return <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p>;
  if (job === null) {
    return <p className="m-0 text-[13px] text-ui-text-secondary">No design job yet — it starts when the deal moves to design (“Start Design” on Handoffs).</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <StatusBadge group="design_job" status={job.status} size="sm" />
        <span className="text-ui-body">{job.designer ? `Designer: ${job.designer}` : 'No designer yet'}</span>
        {job.due_date && <span className="text-ui-text-secondary">· due {formatDate(job.due_date)}</span>}
      </div>
      <p className="m-0 text-[13px] text-ui-body">
        {job.latestVersion ? `Latest: V${job.latestVersion.version_no} — ${VERSION_LABEL[job.latestVersion.status] ?? job.latestVersion.status}` : 'No design version yet.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/design?job=${job.id}`} className={buttonVariants({ size: 'sm' })}><Palette /> Open in Design</Link>
        <Button variant="outline" size="sm" onClick={() => void folderLink()} disabled={busy}><FolderOpen /> Design folder <ExternalLink className="size-3" /></Button>
        {job.sharedUrl && <Button variant="ghost" size="sm" onClick={() => void copyLink()}><Link2 /> Copy link</Button>}
      </div>
      <p className="m-0 text-[11px] text-ui-text-secondary">Notes you write on this deal reach the designer; the approved version is sent to the customer from Design → Versions.</p>
    </div>
  );
}
