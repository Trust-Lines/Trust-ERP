'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorText, fetchJson } from '@/lib/client/fetchJson';
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
    let b: { versions?: SalesDesignVersion[]; files?: DesignFile[] };
    try { b = await fetchJson(`/api/design-jobs/${jobId}/versions`); } catch { return; }
    onVersions(b.versions ?? []);
    const byVersion: Record<string, DesignFile[]> = {};
    for (const f of b.files ?? []) (byVersion[f.version_id] ??= []).push(f);
    for (const v of b.versions ?? []) onDesignFiles(v.id, byVersion[v.id] ?? []);
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
      const b = await fetchJson<{ jobStatus?: SalesDesignJob['status']; syncedVersions?: number; syncedFiles?: number }>(
        `/api/design-jobs/${jobId}/sync-dropbox`, { method: 'POST', errorMessage: 'Sync failed' },
      );
      if (b.jobStatus) onJobLocal({ status: b.jobStatus });
      await reloadVersions();
      if (!quiet || b.syncedVersions || b.syncedFiles) {
        toast.success(b.syncedVersions || b.syncedFiles
          ? `Synced — ${b.syncedVersions} new version${b.syncedVersions === 1 ? '' : 's'}, ${b.syncedFiles} file${b.syncedFiles === 1 ? '' : 's'}`
          : 'Versions are up to date');
      }
    } catch (e) {
      toast.error(errorText(e, 'Sync failed'));
    } finally { setBusy(false); }
  }

  async function newVersion() {
    setBusy(true);
    try {
      const b = await fetchJson<{ versionNo: number; path?: string }>(
        `/api/design-jobs/${jobId}/files`, { method: 'POST', body: { action: 'new-version' }, errorMessage: 'Could not create the version folder' },
      );
      toast.success(`V${b.versionNo} folder ready — upload the design into it`);
      onVersionFolder(b.path ?? `${DESIGN_VERSION_BASE}/V${b.versionNo}`);
    } catch (e) {
      toast.error(errorText(e, 'Could not create the version folder'));
    } finally { setBusy(false); }
  }

  async function patchVersion(v: SalesDesignVersion, patch: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const b = await fetchJson<{ version: SalesDesignVersion }>(
        `/api/design-jobs/${jobId}/versions/${v.id}`, { method: 'PATCH', body: patch, errorMessage: 'Could not update the version' },
      );
      onVersion(b.version);
      if (typeof patch.status === 'string' && JOB_STATUS_FOR_VERSION[patch.status]) onJobLocal({ status: JOB_STATUS_FOR_VERSION[patch.status] });
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not update the version'));
      return false;
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
      const b = await fetchJson<{ url?: string }>(
        `/api/design-jobs/${jobId}/versions/${v.id}/review-link`, { method: 'POST', body: {}, errorMessage: 'Could not create the customer link' },
      );
      if (!b.url) { toast.error('Could not create the customer link'); return; }
      try { await navigator.clipboard.writeText(b.url); toast.success('Customer review link copied — send it to the customer'); }
      catch { toast.success(`Customer review link: ${b.url}`); }
      onVersion({ ...v, status: 'presented' });
      onJobLocal({ status: 'presented_to_customer' });
    } catch (e) {
      toast.error(errorText(e, 'Could not create the customer link'));
    } finally { setBusy(false); }
  }

  async function uploadToVersion(v: SalesDesignVersion, files: File[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      let root: string;
      try {
        ({ root } = await fetchJson<{ root: string }>(`/api/design-jobs/${jobId}/files`, { method: 'POST', body: { action: 'ensure' }, errorMessage: 'Design folder not ready' }));
      } catch (e) { toast.error(errorText(e, 'Design folder not ready')); return; }
      for (const f of files) {
        try { await uploadToDesignFolder(jobId, root, `${DESIGN_VERSION_BASE}/V${v.version_no}`, f); }
        catch (e) { toast.error(e instanceof Error ? e.message : `Could not upload ${f.name}`); }
      }
    } finally { setBusy(false); }
    await syncVersions(true);
  }

  /** Opens a Dropbox temporary link in a new tab (opened first so pop-up blockers allow it). */
  async function openFile(fileId: string, source: FileSource) {
    const win = window.open('', '_blank');
    let link: string | undefined;
    try {
      ({ link } = await fetchJson<{ link?: string }>(`/api/design-jobs/${jobId}/file-link`, { method: 'POST', body: { source, id: fileId }, errorMessage: 'Could not open the file' }));
    } catch (e) { win?.close(); toast.error(errorText(e, 'Could not open the file')); return; }
    if (!link) { win?.close(); toast.error('Could not open the file'); return; }
    if (win) win.location.href = link; else window.open(link, '_blank', 'noopener,noreferrer');
  }

  return { busy, syncVersions, newVersion, patchVersion, requestRevision, sendToCustomer, uploadToVersion, openFile };
}
