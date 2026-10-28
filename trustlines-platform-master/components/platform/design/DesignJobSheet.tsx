'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Box, CheckCheck, ExternalLink, FileText, FolderPlus, Link2, Paperclip, RefreshCw, RotateCcw, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { SalesDesignJob, SalesDesignVersion } from '@/types/database';
import type { LeadBrief, IntakeFile, DesignFile, ProjectMeta } from '@/app/(platform)/design/page';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { DESIGN_VERSION_BASE } from '@/lib/sales/designPaths';
import { DesignFiles, uploadToDesignFolder } from './DesignFiles';
import { JobMaterials } from './JobMaterials';
import { BrandSwatches, type BrandKit } from './library/BrandKitsClient';
import {
  DESIGNER_STATUSES, HEADING, JOB_STATUS_LABEL, JOB_STATUS_ORDER, VERSION_STATUSES, VERSION_STATUS_LABEL, initials,
} from './designShared';

type TabKey = 'brief' | 'notes' | 'files' | 'versions' | 'materials' | 'activity';
interface Note { id: string; author_id: string | null; author_name: string | null; body: string; created_at: string }
interface Activity { id: string; actor_name: string; kind: string; body: string | null; created_at: string }

const FILE_CATEGORY_LABELS: Record<string, string> = {
  plan_layout: 'Plan / Layout', photos: 'Photos', areas_note: 'Areas note', client_special_request_note: 'Special request',
  shelving_note: 'Shelving note', millwork_note: 'Millwork note', image_note: 'Image note', ceiling_note: 'Ceiling note',
};
const cap = (s: string) => s.replace(/_/g, ' ');
const toISODate = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const parseISODate = (s: string | null) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

interface Props {
  job: SalesDesignJob;
  name: string;
  currentUserId: string;
  isManager: boolean;
  designers: { id: string; full_name: string }[];
  designerMap: Record<string, string>;
  brief: LeadBrief | undefined;
  intakeFiles: IntakeFile[];
  meta: ProjectMeta | undefined;
  team: { trustlinesPm: string | null; tlinesPm: string | null } | undefined;
  requestedBy: string | null;
  versions: SalesDesignVersion[];
  designFiles: Record<string, DesignFile[]>;
  today: string;
  onPatchJob: (patch: Record<string, unknown>, okMessage?: string) => Promise<void>;
  onJobLocal: (patch: Partial<SalesDesignJob>) => void;
  onVersions: (versions: SalesDesignVersion[]) => void;
  onVersion: (version: SalesDesignVersion) => void;
  onDesignFiles: (versionId: string, files: DesignFile[]) => void;
  onClose: () => void;
}

export function DesignJobSheet(p: Props) {
  const { job, isManager } = p;
  const [tab, setTab] = useState<TabKey>('brief');
  const [filesPath, setFilesPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(job.dropbox_shared_url ?? null);

  // ── Notes + activity (one request feeds both tabs) ──
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch(`/api/design-jobs/${job.id}/notes`);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not load notes');
      setNotes(b.notes ?? []); setActivity(b.activity ?? []);
    } catch (e) { setNotes([]); toast.error(e instanceof Error ? e.message : 'Could not load notes'); }
  }, [job.id]);
  useEffect(() => { setNotes(null); setActivity([]); setTab('brief'); setSharedUrl(job.dropbox_shared_url ?? null); }, [job.id, job.dropbox_shared_url]);
  useEffect(() => { if ((tab === 'notes' || tab === 'activity') && notes === null) void loadFeed(); }, [tab, notes, loadFeed]);

  async function postNote(text: string, quiet = false): Promise<boolean> {
    const res = await fetch(`/api/design-jobs/${job.id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) }).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { toast.error(b.error ?? 'Could not post the note'); return false; }
    setNotes(n => [...(n ?? []), b.note]);
    if (!quiet) toast.success('Note posted');
    return true;
  }

  // ── Versions ──
  async function reloadVersions() {
    const res = await fetch(`/api/design-jobs/${job.id}/versions`).catch(() => null);
    if (!res?.ok) return;
    const b = await res.json();
    p.onVersions(b.versions ?? []);
    const byVersion: Record<string, DesignFile[]> = {};
    for (const f of (b.files ?? []) as DesignFile[]) (byVersion[f.version_id] ??= []).push(f);
    for (const v of (b.versions ?? []) as SalesDesignVersion[]) p.onDesignFiles(v.id, byVersion[v.id] ?? []);
  }

  async function syncVersions(quiet = false) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${job.id}/sync-dropbox`, { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Sync failed'); return; }
      if (b.jobStatus) p.onJobLocal({ status: b.jobStatus });
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
      const res = await fetch(`/api/design-jobs/${job.id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'new-version' }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not create the version folder'); return; }
      toast.success(`V${b.versionNo} folder ready — upload the design into it`);
      setFilesPath(b.path ?? `${DESIGN_VERSION_BASE}/V${b.versionNo}`);
      setTab('files');
    } finally { setBusy(false); }
  }

  async function patchVersion(v: SalesDesignVersion, patch: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${job.id}/versions/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not update the version'); return false; }
      p.onVersion(b.version);
      const jobStatus: Record<string, string> = { submitted: 'ready_for_sales_review', approved: 'approved_by_sales', revision_requested: 'revision_requested' };
      if (typeof patch.status === 'string' && jobStatus[patch.status]) p.onJobLocal({ status: jobStatus[patch.status] as SalesDesignJob['status'] });
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
      const res = await fetch(`/api/design-jobs/${job.id}/versions/${v.id}/review-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok || !b.url) { toast.error(b.error ?? 'Could not create the customer link'); return; }
      try { await navigator.clipboard.writeText(b.url); toast.success('Customer review link copied — send it to the customer'); }
      catch { toast.success(`Customer review link: ${b.url}`); }
      p.onVersion({ ...v, status: 'presented' });
      p.onJobLocal({ status: 'presented_to_customer' });
    } finally { setBusy(false); }
  }

  async function openDesignFile(fileId: string, source: 'design' | 'intake') {
    const win = window.open('', '_blank');
    const res = await fetch(`/api/design-jobs/${job.id}/file-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, id: fileId }) }).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !b.link) { win?.close(); toast.error(b.error ?? 'Could not open the file'); return; }
    if (win) win.location.href = b.link; else window.open(b.link, '_blank', 'noopener,noreferrer');
  }

  const versionUploadRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<SalesDesignVersion | null>(null);
  async function uploadToVersion(v: SalesDesignVersion, files: File[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      const ens = await fetch(`/api/design-jobs/${job.id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ensure' }) });
      const eb = await ens.json().catch(() => ({}));
      if (!ens.ok) { toast.error(eb.error ?? 'Design folder not ready'); return; }
      for (const f of files) {
        try { await uploadToDesignFolder(job.id, eb.root, `${DESIGN_VERSION_BASE}/V${v.version_no}`, f); }
        catch (e) { toast.error(e instanceof Error ? e.message : `Could not upload ${f.name}`); }
      }
    } finally { setBusy(false); }
    await syncVersions(true);
  }

  const designerName = job.assigned_designer_id ? p.designerMap[job.assigned_designer_id] ?? 'Designer' : null;
  const statusOptions = (isManager ? [...JOB_STATUS_ORDER] : DESIGNER_STATUSES.includes(job.status) ? DESIGNER_STATUSES : [job.status, ...DESIGNER_STATUSES])
    .map(s => ({ value: s, label: JOB_STATUS_LABEL[s] ?? cap(s) }));
  const overdue = !!p.today && !!job.due_date && job.due_date.slice(0, 10) < p.today && !['completed', 'approved_by_sales', 'cancelled'].includes(job.status);
  const site = p.brief ? [p.brief.street, p.brief.city, p.brief.state].filter(Boolean).join(', ') || p.brief.address : null;

  return (
    <Sheet open onOpenChange={o => { if (!o) p.onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-ui-page-bg data-[side=right]:sm:max-w-[880px]">
        <SheetHeader className="gap-1 border-b border-ui-divider px-6 pb-4 pt-5">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className={cn('text-[20px] font-semibold', HEADING)}>{p.name}</SheetTitle>
            <StatusBadge group="design_job" status={job.status} size="sm" />
            {job.priority === 'high' && <span className="text-[11px] font-semibold text-error-normal">High priority</span>}
          </div>
          <SheetDescription className="text-[12px] text-ui-text-secondary">
            {[p.brief?.project_type || 'Design', site, p.meta?.code].filter(Boolean).join(' · ')}
          </SheetDescription>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Status">
              <Select aria-label="Job status" value={job.status} options={statusOptions}
                onValueChange={v => { if (v && v !== job.status) void p.onPatchJob({ status: v }, `Moved to ${JOB_STATUS_LABEL[v] ?? cap(v)}`); }} />
            </Field>
            <Field label="Designer">
              {isManager ? (
                <Select aria-label="Designer" value={job.assigned_designer_id ?? ''}
                  options={[{ value: '', label: 'Unassigned' }, ...p.designers.map(d => ({ value: d.id, label: d.full_name }))]}
                  onValueChange={v => void p.onPatchJob({ assigned_designer_id: v || null }, v ? 'Assigned — the designer has been notified' : 'Unassigned')} />
              ) : <ReadOnly>{designerName ?? 'Unassigned'}</ReadOnly>}
            </Field>
            <Field label="Priority">
              {isManager ? (
                <Select aria-label="Priority" value={job.priority}
                  options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]}
                  onValueChange={v => { if (v) void p.onPatchJob({ priority: v }); }} />
              ) : <ReadOnly className="capitalize">{job.priority}</ReadOnly>}
            </Field>
            <Field label="Due date">
              {isManager ? (
                <DatePicker aria-label="Due date" placeholder="No due date" className={cn('w-full', overdue && 'text-error-normal dark:text-error-normal')}
                  value={parseISODate(job.due_date)} onValueChange={d => void p.onPatchJob({ due_date: toISODate(d) })} />
              ) : <ReadOnly className={overdue ? 'font-semibold text-error-normal' : undefined}>{job.due_date ? formatDate(job.due_date) : '—'}</ReadOnly>}
            </Field>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as TabKey)} className="gap-5 px-6 py-5">
          <TabsList>
            <TabsTrigger value="brief">Brief</TabsTrigger>
            <TabsTrigger value="notes">Notes{notes?.length ? ` · ${notes.length}` : ''}</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="versions">Versions{p.versions.length ? ` · ${p.versions.length}` : ''}</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* ── Brief: what Sales collected ── */}
          <TabsContent value="brief" className="flex flex-col gap-5">
            <Card title="Customer brief — from Sales">
              <dl className="m-0 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[13px]">
                {([['Customer', p.brief?.customer_name || p.brief?.brand], ['Site', site], ['Project type', p.brief?.project_type]] as [string, string | null | undefined][]).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ui-text-secondary">{k}</dt>
                    <dd className={cn('m-0', v ? HEADING : 'text-ui-text-secondary')}>{v || '—'}</dd>
                  </div>
                ))}
                {Object.entries(p.brief?.scope_of_work ?? {}).some(([, v]) => v) && (
                  <div className="contents">
                    <dt className="text-ui-text-secondary">Scope</dt>
                    <dd className="m-0 flex flex-wrap gap-1.5">
                      {Object.entries(p.brief?.scope_of_work ?? {}).filter(([, v]) => v).map(([k]) => (
                        <span key={k} className="rounded-[4px] bg-[var(--status-t0-bg)] px-2 py-0.5 text-[12px] capitalize text-[var(--status-t0-fg)]">{cap(k)}</span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
              {job.brief && <p className="m-0 mt-3 whitespace-pre-wrap text-[13px] text-ui-body">{job.brief}</p>}
              {p.brief?.matterport_link && (
                <a href={p.brief.matterport_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-fit items-center gap-1.5 text-[13px] text-ui-link">
                  <Box size={14} aria-hidden /> Open 360 walkthrough <ExternalLink size={12} aria-hidden />
                </a>
              )}
              {Object.entries(p.brief?.notes ?? {}).filter(([, v]) => (v ?? '').trim()).length > 0 && (
                <div className="mt-4 flex flex-col gap-1">
                  <p className="m-0 text-[12px] font-semibold text-ui-text-secondary">Notes from the intake form</p>
                  {Object.entries(p.brief?.notes ?? {}).filter(([, v]) => (v ?? '').trim()).map(([k, v]) => (
                    <p key={k} className="m-0 text-[13px] text-ui-body"><span className="capitalize text-ui-text-secondary">{cap(k)}:</span> {v}</p>
                  ))}
                </div>
              )}
            </Card>

            <Card title={`Customer files (${p.intakeFiles.length})`} icon={<Paperclip size={14} aria-hidden />}>
              {p.intakeFiles.length === 0 ? (
                <p className="m-0 text-[13px] text-ui-text-secondary">No files on the intake form. Sales&apos; deal files and notes are under Notes and Files.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {Object.entries(p.intakeFiles.reduce<Record<string, IntakeFile[]>>((a, f) => { (a[f.category] ??= []).push(f); return a; }, {})).map(([cat, list]) => (
                    <div key={cat} className="flex flex-col gap-1.5">
                      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-ui-text-secondary">{FILE_CATEGORY_LABELS[cat] ?? cap(cat)}</p>
                      <div className="flex flex-wrap gap-2">
                        {list.map(f => <Button key={f.id} variant="outline" size="sm" onClick={() => void openDesignFile(f.id, 'intake')}><FileText /> {f.file_name}</Button>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <BrandKitCard prospectId={p.brief?.prospect_id ?? null} />

            <div className="grid gap-5 sm:grid-cols-2">
              <Card title="Team">
                <Person label="Designer" name={designerName} empty="Unassigned" />
                <Person label="Requested by" name={p.requestedBy} empty="—" />
                <Person label="Trust PM" name={p.team?.trustlinesPm ?? null} empty="Not assigned yet" />
                <Person label="Client PM" name={p.team?.tlinesPm ?? null} empty="Not assigned yet" />
              </Card>
              <Card title="Shared with Sales">
                <p className="m-0 text-[13px] text-ui-body">The design folder is shared with Sales; they open it from the deal in the CRM.</p>
                {sharedUrl
                  ? <a href={sharedUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-[13px] text-ui-link"><Link2 size={14} aria-hidden /> Open shared folder</a>
                  : <Button variant="outline" size="sm" className="w-fit" onClick={() => setTab('files')}><Link2 /> Set up in Files</Button>}
                <p className="m-0 text-[12px] text-ui-text-secondary">Created {formatDate(job.created_at)} · updated {formatDate(job.updated_at)}</p>
              </Card>
            </div>
          </TabsContent>

          {/* ── Notes: the deal's own notes, shared with the CRM ── */}
          <TabsContent value="notes">
            <NotesTab notes={notes} me={p.currentUserId} onPost={t => postNote(t)} />
          </TabsContent>

          {/* ── Files: the Dropbox design folder ── */}
          <TabsContent value="files">
            <DesignFiles jobId={job.id} initialPath={filesPath} onVersionFiles={() => void syncVersions(true)} onSharedUrl={setSharedUrl} />
          </TabsContent>

          {/* ── Materials: what the design specifies from the catalogue ── */}
          <TabsContent value="materials">
            <JobMaterials jobId={job.id} />
          </TabsContent>

          {/* ── Versions: designer → Sales → customer ── */}
          <TabsContent value="versions" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 max-w-[460px] text-[12px] text-ui-text-secondary">
                A version is a V1, V2… folder under Design proposal. The designer sends it to Sales; Sales approves it and sends the customer a review link.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void syncVersions()} disabled={busy}><RefreshCw /> Sync from Dropbox</Button>
                <Button size="sm" onClick={newVersion} disabled={busy}><FolderPlus /> New version</Button>
              </div>
            </div>
            <input ref={versionUploadRef} type="file" multiple hidden onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (uploadFor) void uploadToVersion(uploadFor, fs); }} />
            {p.versions.length === 0 ? (
              <div className="rounded-[8px] bg-ui-surface p-5">
                <EmptyState icon={<FolderPlus />} title="No versions yet" description="Create V1, upload the design into it, then send it to Sales." />
              </div>
            ) : p.versions.map(v => {
              const files = p.designFiles[v.id] ?? [];
              const canSend = v.status === 'draft' || v.status === 'revision_requested';
              return (
                <div key={v.id} className="flex flex-col gap-3 rounded-[8px] border border-ui-divider bg-ui-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-[15px] font-semibold', HEADING)}>V{v.version_no}</span>
                    <StatusBadge group="design_version" status={v.status} size="sm" />
                    <span className="text-[11px] text-ui-text-secondary">{formatDate(v.created_at)}{v.presented_at ? ` · sent ${formatDate(v.presented_at)}` : ''}</span>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setUploadFor(v); versionUploadRef.current?.click(); }}><Upload /> Upload</Button>
                    {canSend && <Button size="sm" disabled={busy || files.length === 0} title={files.length ? undefined : 'Upload the design first'} onClick={() => void patchVersion(v, { status: 'submitted' }, 'Sent to Sales for review')}><Send /> Send to Sales</Button>}
                    {isManager && v.status === 'submitted' && (
                      <>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void requestRevision(v)}><RotateCcw /> Request revision</Button>
                        <Button size="sm" disabled={busy} onClick={() => void patchVersion(v, { status: 'approved' }, 'Design approved')}><CheckCheck /> Approve</Button>
                      </>
                    )}
                    {isManager && (v.status === 'approved' || v.status === 'presented') && (
                      <Button size="sm" disabled={busy} onClick={() => void sendToCustomer(v)}><Send /> {v.status === 'presented' ? 'New customer link' : 'Send to customer'}</Button>
                    )}
                    {isManager && (
                      <Select aria-label={`V${v.version_no} status`} className="w-[140px]" value={v.status}
                        options={VERSION_STATUSES.map(s => ({ value: s, label: VERSION_STATUS_LABEL[s] }))}
                        onValueChange={s => { if (s && s !== v.status) void patchVersion(v, { status: s }, 'Version updated'); }} />
                    )}
                  </div>
                  {files.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {files.map(f => <Button key={f.id} variant="outline" size="sm" onClick={() => void openDesignFile(f.id, 'design')}><FileText /> {f.file_name}</Button>)}
                    </div>
                  ) : <p className="m-0 text-[12px] text-ui-text-secondary">No files in this version yet.</p>}
                  {v.notes && v.notes !== 'Auto-synced from Dropbox' && <p className="m-0 text-[12px] text-ui-body">{v.notes}</p>}
                  {v.customer_feedback && (
                    <p className="m-0 rounded-[6px] bg-[var(--status-t7-bg)] px-3 py-2 text-[12px] text-[var(--status-t7-fg)]"><b>Customer feedback:</b> {v.customer_feedback}</p>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* ── Activity ── */}
          <TabsContent value="activity">
            {notes === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : activity.length === 0 ? (
              <p className="m-0 text-[13px] text-ui-text-secondary">Nothing yet.</p>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-0 p-0">
                {activity.map(a => (
                  <li key={a.id} className="flex gap-3 border-b border-ui-divider py-2.5 text-[13px] last:border-0">
                    <span className="w-[130px] shrink-0 text-[12px] text-ui-text-secondary">{formatDateTime(a.created_at)}</span>
                    <span className="text-ui-body"><b className={HEADING}>{a.actor_name}</b> {a.kind === 'comment' ? 'wrote: ' : ''}{a.body}</span>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function NotesTab({ notes, me, onPost }: { notes: Note[] | null; me: string; onPost: (text: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [notes?.length]);

  async function send() {
    const t = draft.trim();
    if (!t || sending) return;
    setSending(true);
    if (await onPost(t)) setDraft('');
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[12px] text-ui-text-secondary">The same notes Sales sees on the deal in the CRM — a note here notifies Sales, a note there notifies the designer.</p>
      <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-[8px] bg-ui-surface p-4">
        {notes === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p>
          : notes.length === 0 ? <p className="m-0 text-[13px] text-ui-text-secondary">No notes yet. Ask Sales a question or leave an update.</p>
          : notes.map(n => {
            const mine = n.author_id === me;
            return (
              <div key={n.id} className={cn('flex max-w-[85%] flex-col gap-1', mine && 'self-end items-end')}>
                <span className="text-[11px] text-ui-text-secondary">{n.author_name ?? 'Someone'} · {formatDateTime(n.created_at)}</span>
                <p className={cn('m-0 whitespace-pre-wrap rounded-[8px] px-3 py-2 text-[13px]', mine ? 'bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950' : 'bg-ui-surface-elevated text-ui-body')}>{n.body}</p>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label="New note" placeholder="Write a note… (Ctrl+Enter to send)" rows={3} value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
        />
        <Button size="sm" className="self-end" disabled={!draft.trim() || sending} onClick={() => void send()}><Send /> {sending ? 'Sending…' : 'Post note'}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><span className="text-[11px] font-medium text-ui-text-secondary">{label}</span>{children}</div>;
}

function ReadOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('flex h-8 items-center text-[13px]', HEADING, className)}>{children}</span>;
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[8px] bg-ui-surface p-4">
      <h3 className={cn('m-0 flex items-center gap-1.5 text-[13px] font-semibold', HEADING)}>{icon}{title}</h3>
      {children}
    </section>
  );
}

function Person({ label, name, empty }: { label: string; name: string | null; empty: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className={cn('grid size-[28px] shrink-0 place-items-center rounded-full bg-ui-surface-elevated text-[10px] font-semibold', HEADING)}>{initials(name)}</span>
      <div className="min-w-0">
        <p className="m-0 text-[10.5px] uppercase tracking-wide text-ui-text-secondary">{label}</p>
        <p className={cn('m-0 truncate text-[13px]', name ? HEADING : 'text-ui-text-secondary')}>{name ?? empty}</p>
      </div>
    </div>
  );
}

/** The customer's Brand Kit(s) on the Brief — colours to copy, fonts, rules, link to the files. */
function BrandKitCard({ prospectId }: { prospectId: string | null }) {
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  useEffect(() => {
    if (!prospectId) { setKits([]); return; }
    let live = true;
    fetch(`/api/design/brands?prospectId=${prospectId}`).then(r => (r.ok ? r.json() : { kits: [] })).then(b => { if (live) setKits(b.kits ?? []); }).catch(() => { if (live) setKits([]); });
    return () => { live = false; };
  }, [prospectId]);
  if (!kits || (!kits.length && !prospectId)) return null;
  return (
    <Card title="Brand kit">
      {kits.length === 0 ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">No brand kit for this customer yet — <Link href="/design/brands" className="text-ui-link">create one</Link> with the logo, colours and fonts.</p>
      ) : kits.map(k => (
        <div key={k.id} className="flex flex-col gap-2">
          <p className={cn('m-0 text-[13px] font-medium', HEADING)}>{k.name}{k.fonts.length ? <span className="font-normal text-ui-text-secondary"> · {k.fonts.join(', ')}</span> : null}</p>
          <BrandSwatches colors={k.colors} />
          {k.guidelines && <p className="m-0 line-clamp-3 whitespace-pre-wrap text-[12px] text-ui-body">{k.guidelines}</p>}
          <Link href="/design/brands" className="w-fit text-[12px] text-ui-link">Logo & files in Brand Kits →</Link>
        </div>
      ))}
    </Card>
  );
}
