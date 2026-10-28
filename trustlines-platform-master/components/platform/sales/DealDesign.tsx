'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FolderOpen, Link2, Palette, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/formatDate';

interface DealDesignJob {
  id: string; title: string; brief: string | null; assigned_designer_id: string | null;
  status: string; priority: string; due_date: string | null;
  designer: string | null; folder: string | null; sharedUrl: string | null;
  latestVersion: { version_no: number; status: string } | null;
}

const VERSION_LABEL: Record<string, string> = {
  draft: 'draft', submitted: 'waiting for your review', presented: 'with the customer',
  approved: 'approved', revision_requested: 'in revision', rejected: 'rejected',
};

/**
 * The deal panel's "Design" card. No job yet → "Send to Design" (a lead moves to "Working on it
 * Trust", an accepted Opportunity starts Design — the same triggers as before, now one button).
 * With a job: pick the designer, write the brief, see the latest version, open the shared Dropbox
 * design folder. People without Sales access (Marketing) get a one-line note instead.
 */
export function DealDesign({ opportunityId, leadId, onStarted }: {
  opportunityId?: string; leadId?: string;
  /** The deal's stage changed (lead → Working on it Trust) — let the panel reload its fields. */
  onStarted?: () => void;
}) {
  const [job, setJob] = useState<DealDesignJob | null | undefined>(undefined);
  const [designers, setDesigners] = useState<{ id: string; full_name: string }[]>([]);
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false); // no Sales access (e.g. Marketing)
  const query = opportunityId ? `opportunityId=${opportunityId}` : `leadId=${leadId}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/design-jobs/lookup?${query}`).catch(() => null);
    if (res && (res.status === 401 || res.status === 403)) { setHidden(true); return; }
    if (!res?.ok) { setJob(null); return; }
    const b = await res.json().catch(() => ({}));
    setJob(b.job ?? null);
    setBrief(b.job?.brief ?? '');
    setDesigners(b.designers ?? []);
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  async function sendToDesign() {
    setBusy(true);
    try {
      const res = opportunityId
        ? await fetch(`/api/sales/opportunities/${opportunityId}/start-design`, { method: 'POST' })
        : await fetch(`/api/leads/${leadId}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opportunity_status: 'working_on_it_trust' }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not send to Design'); return; }
      toast.success('Sent to Design — pick a designer and add a brief');
      onStarted?.();
      await load();
    } catch { toast.error('Could not send to Design'); }
    finally { setBusy(false); }
  }

  async function patchJob(patch: Record<string, unknown>, ok: string) {
    if (!job) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${job.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      toast.success(ok);
      await load();
    } catch { toast.error('Could not save'); }
    finally { setBusy(false); }
  }

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
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[13px] text-ui-body">
          Not in Design yet. Sending it creates the design job and its Dropbox design folder
          {leadId ? ' and moves the lead to “Working on it Trust”.' : ' (the Opportunity must be Sales Accepted).'}
        </p>
        <Button size="sm" className="w-fit" onClick={() => void sendToDesign()} disabled={busy}><Send /> {busy ? 'Sending…' : 'Send to Design'}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <StatusBadge group="design_job" status={job.status} size="sm" />
        {job.due_date && <span className="text-ui-text-secondary">due {formatDate(job.due_date)}</span>}
        <span className="text-ui-body">
          {job.latestVersion ? `· V${job.latestVersion.version_no} ${VERSION_LABEL[job.latestVersion.status] ?? job.latestVersion.status}` : '· no version yet'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-ui-text-secondary">
          Designer
          <Select
            aria-label="Designer" placeholder="Assign a designer…" disabled={busy}
            value={job.assigned_designer_id ?? ''}
            options={[{ value: '', label: 'Unassigned' }, ...designers.map(d => ({ value: d.id, label: d.full_name }))]}
            onValueChange={v => { if ((v || null) !== job.assigned_designer_id) void patchJob({ assigned_designer_id: v || null }, v ? 'Designer assigned and notified' : 'Designer removed'); }}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-ui-text-secondary">
          Brief for the designer
          <Textarea
            aria-label="Brief for the designer" rows={2} value={brief} disabled={busy}
            placeholder="What to design, must-haves, deadline…"
            onChange={e => setBrief(e.target.value)}
            onBlur={() => { if (brief.trim() !== (job.brief ?? '').trim()) void patchJob({ brief: brief.trim() || null }, 'Brief saved'); }}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/design?job=${job.id}`} className={buttonVariants({ size: 'sm' })}><Palette /> Open in Design</Link>
        <Button variant="outline" size="sm" onClick={() => void folderLink()} disabled={busy}><FolderOpen /> Design folder <ExternalLink className="size-3" /></Button>
        {job.sharedUrl && <Button variant="ghost" size="sm" onClick={() => void copyLink()}><Link2 /> Copy link</Button>}
      </div>
      <p className="m-0 text-[11px] text-ui-text-secondary">Notes you write on this deal reach the designer; the approved version goes to the customer from Design → Versions.</p>
    </div>
  );
}
