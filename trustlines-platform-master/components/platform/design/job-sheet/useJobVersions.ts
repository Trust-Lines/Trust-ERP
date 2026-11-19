'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { SalesDesignJob, SalesDesignVersion } from '@/types/database';
import type { DesignFile } from '@/app/(platform)/design/page';
import { DESIGN_VERSION_BASE } from '@/lib/sales/designPaths';
import { uploadToDesignFolder } from '../DesignFiles';
import type { FileSource } from './sheetShared';

/** Job status a version status change moves the job to. */
const JOB_STATUS_FOR_VERSION: Record<string, SalesDesignJob['status']> = {
  submitted: 'ready_for_sales_review', approved: 'approved_by_sales', revision_requested: 'revision_requested',
};

/**
 * Version workflow for one job: reload, live Dropbox updates, sync, new version folder,
 * status changes (designer → Sales → customer), uploads, and opening Dropbox files.
 */
export function useJobVersions({ jobId, onVersions, onVersion, onDesignFiles, onJobLocal, postNote, onVersionFolder }: {
  jobId: string;
  onVersions: (versions: SalesDesignVersion[]) => void;
  onVersion: (version: SalesDesignVersion) => void;
  onDesignFiles: (versionId: string, files: DesignFile[]) => void;
  onJobLocal: (patch: Partial<SalesDesignJob>) => void;
  postNote: (text: string, quiet?: boolean) => Promise<boolean>;
  /** A new version folder is ready at this path (opens it in the Files tab). */
  onVersionFolder: (path: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function reloadVersions() {
    const res = await fetch(`/api/design-jobs/${jobId}/versions`).catch(() => null);
    if (!res?.ok) return;
    const b = await res.json();
    onVersions(b.versions ?? []);
    const byVersion: Record<string, DesignFile[]> = {};
    for (const f of (b.files ?? []) as DesignFile[]) (byVersion[f.version_id] ??= []).push(f);
    for (const v of (b.versions ?? []) as SalesDesignVersion[]) onDesignFiles(v.id, byVersion[v.id] ?? []);
  }

  // Live: the Dropbox webhook adds versions / files as soon as they land in the design folder.
  const reloadRef = useRef(reloadVersions);
  useEffect(() => { reloadRef.current = reloadVersions; });
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void reloadRef.current(), 1000); };
    const channel = supabase.channel(`design-job-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_design_versions', filter: `job_id=eq.${jobId}` }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_design_version_files', filter: `job_id=eq.${jobId}` }, bump)
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [jobId]);

  async function syncVersions(quiet = false) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/sync-dropbox`, { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Sync failed'); return; }
      if (b.jobStatus) onJobLocal({ status: b.jobStatus });
      await reloadVersions();
      if (!quiet || b.syncedVersions || b.syncedFiles) {
        toast.success(b.syncedVersions || b.syncedFiles
          ? `Synced — ${b.syncedVersions} new version${b.syncedVersions === 1 ? '' : 's'}, ${b.syncedFiles} file${b.syncedFiles === 1 ? '' : 's'}`
          : 'Versions are up to date');
      }
    } finally { setBusy(false); }
  }

  async function newVersion() {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'new-version' }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not create the version folder'); return; }
      toast.success(`V${b.versionNo} folder ready — upload the design into it`);
      onVersionFolder(b.path ?? `${DESIGN_VERSION_BASE}/V${b.versionNo}`);
    } finally { setBusy(false); }
  }

  async function patchVersion(v: SalesDesignVersion, patch: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/versions/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not update the version'); return false; }
      onVersion(b.version);
      if (typeof patch.status === 'string' && JOB_STATUS_FOR_VERSION[patch.status]) onJobLocal({ status: JOB_STATUS_FOR_VERSION[patch.status] });
      toast.success(ok);
      return true;
    } finally { setBusy(false); }
  }

  async function requestRevision(v: SalesDesignVersion) {
    const reason = window.prompt(`What should change in V${v.version_no}? The designer gets this as a note.`);
    if (!reason?.trim()) return;
    if (await patchVersion(v, { status: 'revision_requested' }, 'Revision requested')) await postNote(`Revision on V${v.version_no}: ${reason.trim()}`, true);
  }

  async function sendToCustomer(v: SalesDesignVersion) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/versions/${v.id}/review-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok || !b.url) { toast.error(b.error ?? 'Could not create the customer link'); return; }
      try { await navigator.clipboard.writeText(b.url); toast.success('Customer review link copied — send it to the customer'); }
      catch { toast.success(`Customer review link: ${b.url}`); }
      onVersion({ ...v, status: 'presented' });
      onJobLocal({ status: 'presented_to_customer' });
    } finally { setBusy(false); }
  }

  async function uploadToVersion(v: SalesDesignVersion, files: File[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      const ens = await fetch(`/api/design-jobs/${jobId}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ensure' }) });
      const eb = await ens.json().catch(() => ({}));
      if (!ens.ok) { toast.error(eb.error ?? 'Design folder not ready'); return; }
      for (const f of files) {
        try { await uploadToDesignFolder(jobId, eb.root, `${DESIGN_VERSION_BASE}/V${v.version_no}`, f); }
        catch (e) { toast.error(e instanceof Error ? e.message : `Could not upload ${f.name}`); }
      }
    } finally { setBusy(false); }
    await syncVersions(true);
  }

  /** Opens a Dropbox temporary link in a new tab (opened first so pop-up blockers allow it). */
  async function openFile(fileId: string, source: FileSource) {
    const win = window.open('', '_blank');
    const res = await fetch(`/api/design-jobs/${jobId}/file-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, id: fileId }) }).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !b.link) { win?.close(); toast.error(b.error ?? 'Could not open the file'); return; }
    if (win) win.location.href = b.link; else window.open(b.link, '_blank', 'noopener,noreferrer');
  }

  return { busy, syncVersions, newVersion, patchVersion, requestRevision, sendToCustomer, uploadToVersion, openFile };
}
