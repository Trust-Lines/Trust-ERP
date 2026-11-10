'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Box, CheckCheck, ChevronsUp, Download, ExternalLink, FileText, FolderPlus, Link2, Plus, RefreshCw, RotateCcw, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { SalesDesignJob, SalesDesignVersion } from '@/types/database';
import type { LeadBrief, IntakeFile, DesignFile, ProjectMeta } from '@/app/(platform)/design/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { PersonFace } from '@/components/ui/avatar-directory';
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
  /** Sales reviewer: approve / revise sent designs, then send to the customer and download. */
  salesView?: boolean;
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
  const sales = !!p.salesView;
  const [tab, setTab] = useState<TabKey>(sales ? 'versions' : 'brief');
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
  useEffect(() => { setNotes(null); setActivity([]); setTab(sales ? 'versions' : 'brief'); setSharedUrl(job.dropbox_shared_url ?? null); }, [job.id, job.dropbox_shared_url, sales]);
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

  // Live: the Dropbox webhook adds versions / files as soon as they land in the design folder.
  const reloadRef = useRef(reloadVersions);
  useEffect(() => { reloadRef.current = reloadVersions; });
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void reloadRef.current(), 1000); };
    const channel = supabase.channel(`design-job-${job.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_design_versions', filter: `job_id=eq.${job.id}` }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_design_version_files', filter: `job_id=eq.${job.id}` }, bump)
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [job.id]);

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

  const customer = p.brief?.customer_name?.trim() || p.brief?.brand?.trim() || null;
  const subtitle = [customer, site].filter(Boolean).join(' - ');
  const title = [p.brief?.project_type?.trim(), p.meta?.code].filter(Boolean).join(' - ') || p.name;
  const team = ([['Designer', designerName], ['Requested by', p.requestedBy], ['Trust PM', p.team?.trustlinesPm ?? null], ['Client PM', p.team?.tlinesPm ?? null]] as [string, string | null][]);
  const scope = Object.entries(p.brief?.scope_of_work ?? {}).filter(([, v]) => v).map(([k]) => k);
  const intakeNotes = Object.entries(p.brief?.notes ?? {}).filter(([, v]) => (v ?? '').trim());

  return (
    <DialogPrimitive.Root open onOpenChange={o => { if (!o) p.onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-primary-950/40 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup
          data-slot="design-job-modal"
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1268px] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-[11px] bg-ui-page-bg p-4 font-[family-name:var(--font-ui)] shadow-04 outline-none transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 sm:p-8"
        >
          {/* ── Heading: project, job, status + priority chips ── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 flex-col">
                {subtitle && <DialogPrimitive.Description className="m-0 truncate text-[16px] text-ui-text-secondary">{subtitle}</DialogPrimitive.Description>}
                <DialogPrimitive.Title className={cn('m-0 text-[22px] font-semibold leading-[1.25] sm:text-[28px]', HEADING)}>{title}</DialogPrimitive.Title>
              </div>
              <div className="flex flex-wrap items-start gap-[5px]">
                <StatusBadge group="design_job" status={job.status} className={CHIP} />
                {job.priority === 'high' && (
                  <span className={cn('inline-flex items-center rounded-[4px] font-medium', CHIP)} style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>
                    <ChevronsUp aria-hidden /> High
                  </span>
                )}
              </div>
            </div>
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-md" aria-label="Close" className={cn('-mr-1 shrink-0 [&_svg]:size-8', HEADING)} />}>
              <X strokeWidth={1.5} />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-4">
            {/* ── General Info ── */}
            <section className="flex flex-col gap-2 rounded-[8px] border border-ui-divider bg-ui-surface px-3.5 pt-3.5 pb-6">
              <h3 className={cn('m-0 text-[16px] font-semibold leading-[1.45]', HEADING)}>General Info</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Status">
                  {sales ? <ReadOnly>{JOB_STATUS_LABEL[job.status] ?? cap(job.status)}</ReadOnly> : (
                    <Select aria-label="Job status" className={INPUT_CLS} value={job.status} options={statusOptions}
                      onValueChange={v => { if (v && v !== job.status) void p.onPatchJob({ status: v }, `Moved to ${JOB_STATUS_LABEL[v] ?? cap(v)}`); }} />
                  )}
                </Field>
                <Field label="Designer">
                  {isManager ? (
                    <Select aria-label="Designer" className={INPUT_CLS} value={job.assigned_designer_id ?? ''}
                      options={[{ value: '', label: 'Unassigned' }, ...p.designers.map(d => ({ value: d.id, label: d.full_name }))]}
                      onValueChange={v => void p.onPatchJob({ assigned_designer_id: v || null }, v ? 'Assigned — the designer has been notified' : 'Unassigned')} />
                  ) : <ReadOnly>{designerName ?? 'Unassigned'}</ReadOnly>}
                </Field>
                <Field label="Priority">
                  {isManager ? (
                    <Select aria-label="Priority" className={cn(INPUT_CLS, 'uppercase')} value={job.priority}
                      options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]}
                      onValueChange={v => { if (v) void p.onPatchJob({ priority: v }); }} />
                  ) : <ReadOnly className="uppercase">{job.priority}</ReadOnly>}
                </Field>
                <Field label="Due Date">
                  {isManager ? (
                    <DatePicker aria-label="Due date" placeholder="No due date"
                      className={cn(INPUT_CLS, 'w-full flex-row-reverse justify-between border-[var(--color-secondary-700)] dark:border-ui-heading [&_svg]:size-4', overdue && 'text-error-normal dark:text-error-normal')}
                      value={parseISODate(job.due_date)} onValueChange={d => void p.onPatchJob({ due_date: toISODate(d) })} />
                  ) : <ReadOnly className={overdue ? 'text-error-normal dark:text-error-normal' : undefined}>{job.due_date ? formatDate(job.due_date) : '—'}</ReadOnly>}
                </Field>
              </div>
            </section>

            <Tabs value={tab} onValueChange={v => setTab(v as TabKey)} className="gap-4">
              <TabsList className="flex h-12 w-full gap-8 overflow-x-auto border-b border-ui-divider">
                <TabsTrigger className={TAB_CLS} value="brief">Brief</TabsTrigger>
                <TabsTrigger className={TAB_CLS} value="notes">Notes{notes?.length ? ` · ${notes.length}` : ''}</TabsTrigger>
                {!sales && <TabsTrigger className={TAB_CLS} value="files">Files</TabsTrigger>}
                <TabsTrigger className={TAB_CLS} value="versions">Versions{p.versions.length ? ` · ${p.versions.length}` : ''}</TabsTrigger>
                {!sales && <TabsTrigger className={TAB_CLS} value="materials">Materials</TabsTrigger>}
                <TabsTrigger className={TAB_CLS} value="activity">Activity</TabsTrigger>
              </TabsList>

              {/* ── Brief: what Sales collected ── */}
              <TabsContent value="brief" className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Card title="Customer Brief">
                    <div className="flex flex-col gap-4">
                      {([['Customer', customer], ['Site', site], ['Project Type', p.brief?.project_type]] as [string, string | null | undefined][]).map(([k, v]) => (
                        <div key={k} className="flex min-w-0 flex-col gap-1">
                          <span className="text-[12px] font-medium leading-4 text-ui-body">{k}</span>
                          <span className={cn('break-words text-[13px] font-semibold leading-[1.5] tracking-[-0.286px]', HEADING)}>{v || '-'}</span>
                        </div>
                      ))}
                      {scope.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[12px] font-medium leading-4 text-ui-body">Scope</span>
                          <div className="flex flex-wrap gap-1.5">
                            {scope.map(k => <span key={k} className="rounded-[4px] bg-[var(--status-t0-bg)] px-2 py-0.5 text-[12px] capitalize text-[var(--status-t0-fg)]">{cap(k)}</span>)}
                          </div>
                        </div>
                      )}
                      {job.brief && <p className="m-0 whitespace-pre-wrap text-[13px] text-ui-body">{job.brief}</p>}
                      {p.brief?.matterport_link && (
                        <a href={p.brief.matterport_link} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-[13px] text-ui-link">
                          <Box size={14} aria-hidden /> Open 360 walkthrough <ExternalLink size={12} aria-hidden />
                        </a>
                      )}
                      {intakeNotes.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[12px] font-medium leading-4 text-ui-body">Notes from the intake form</span>
                          {intakeNotes.map(([k, v]) => (
                            <p key={k} className="m-0 text-[13px] text-ui-body"><span className="capitalize text-ui-text-secondary">{cap(k)}:</span> {v}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card title={`Customer Files (${p.intakeFiles.length})`}>
                    {p.intakeFiles.length === 0 ? (
                      <p className="m-0 text-[13px] text-ui-text-secondary">No files on the intake form. Sales&apos; deal files and notes are under Notes and Files.</p>
                    ) : (
                      <ul className="m-0 flex list-none flex-col p-0">
                        {p.intakeFiles.map(f => (
                          <li key={f.id} className="flex items-center justify-between gap-3 border-b border-ui-divider py-[5px] first:pt-0 last:border-0 last:pb-0">
                            <div className="flex min-w-0 flex-col">
                              <span className={cn('truncate text-[13px] font-semibold tracking-[-0.286px]', HEADING)} title={f.file_name}>{f.file_name}</span>
                              <span className="truncate text-[10px] tracking-[-0.22px] text-ui-text-secondary">{FILE_CATEGORY_LABELS[f.category] ?? cap(f.category)}</span>
                            </div>
                            <Button size="icon-xs" aria-label={`Open ${f.file_name}`} onClick={() => void openDesignFile(f.id, 'intake')}><ExternalLink /></Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  <Card title={`Team (${team.filter(([, n]) => n).length})`}>
                    <ul className="m-0 flex list-none flex-col p-0">
                      {team.map(([role, name]) => (
                        <li key={role} className="flex items-center justify-between gap-3 border-b border-ui-divider py-[5px] first:pt-0 last:border-0 last:pb-0">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span aria-hidden className="grid size-[31px] shrink-0 place-items-center overflow-hidden rounded-[6px] bg-ui-selected-bg text-[10px] leading-[1.4] text-ui-body"><PersonFace name={name} fallback={initials(name)} /></span>
                            <div className="flex min-w-0 flex-col">
                              <span className={cn('truncate text-[13px] font-semibold tracking-[-0.286px]', name ? HEADING : 'text-ui-text-secondary')}>{name ?? (role === 'Designer' ? 'Unassigned' : 'Not assigned yet')}</span>
                              <span className="truncate text-[10px] tracking-[-0.22px] text-ui-text-secondary">{role}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <BrandKitCard prospectId={p.brief?.prospect_id ?? null} />
                </div>

                <section className="flex flex-col gap-3 rounded-[8px] border border-ui-divider bg-ui-page-bg px-3.5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col leading-[1.35]">
                    <h3 className={cn('m-0 text-[16px] font-semibold', HEADING)}>Shared with Sales</h3>
                    <p className="m-0 text-[13px] text-ui-body">The design folder is shared with Sales; they open it from the deal in the CRM.</p>
                  </div>
                  {sharedUrl ? (
                    <a href={sharedUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: 'md' }), 'w-fit pl-3 pr-4 text-[13px] font-medium no-underline [&_svg]:size-4')}>
                      <Link2 aria-hidden /> Open shared folder
                    </a>
                  ) : !sales && (
                    <Button size="md" className="w-fit pl-3 pr-4 text-[13px] font-medium [&_svg]:size-4" onClick={() => setTab('files')}><Link2 /> Set up in Files</Button>
                  )}
                </section>
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
                {sales
                  ? 'Designs the designer sent you. Approve one (or ask for a revision); once approved you can send it to the customer and download its files.'
                  : 'A version is a V1, V2… folder under Design proposal. The designer sends it to Sales; Sales approves it and sends the customer a review link.'}
              </p>
              {!sales && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void syncVersions()} disabled={busy}><RefreshCw /> Sync from Dropbox</Button>
                  <Button size="sm" onClick={newVersion} disabled={busy}><FolderPlus /> New version</Button>
                </div>
              )}
            </div>
            <input ref={versionUploadRef} type="file" multiple hidden onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (uploadFor) void uploadToVersion(uploadFor, fs); }} />
            {p.versions.length === 0 ? (
              <div className="rounded-[8px] bg-ui-surface p-5">
                {sales
                  ? <EmptyState icon={<FolderPlus />} title="Nothing to review yet" description="The designer has not sent a version to Sales yet." />
                  : <EmptyState icon={<FolderPlus />} title="No versions yet" description="Create V1, upload the design into it, then send it to Sales." />}
              </div>
            ) : p.versions.map(v => {
              const files = p.designFiles[v.id] ?? [];
              const canSend = !sales && (v.status === 'draft' || v.status === 'revision_requested');
              const approved = v.status === 'approved' || v.status === 'presented';
              return (
                <div key={v.id} className="flex flex-col gap-3 rounded-[8px] border border-ui-divider bg-ui-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-[15px] font-semibold', HEADING)}>V{v.version_no}</span>
                    <StatusBadge group="design_version" status={v.status} size="sm" />
                    <span className="text-[11px] text-ui-text-secondary">{formatDate(v.created_at)}{v.presented_at ? ` · sent ${formatDate(v.presented_at)}` : ''}</span>
                    <div className="flex-1" />
                    {!sales && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setUploadFor(v); versionUploadRef.current?.click(); }}><Upload /> Upload</Button>}
                    {canSend && <Button size="sm" disabled={busy || files.length === 0} title={files.length ? undefined : 'Upload the design first'} onClick={() => void patchVersion(v, { status: 'submitted' }, 'Sent to Sales for review')}><Send /> Send to Sales</Button>}
                    {(isManager || sales) && v.status === 'submitted' && (
                      <>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void requestRevision(v)}><RotateCcw /> Request revision</Button>
                        <Button size="sm" disabled={busy} onClick={() => void patchVersion(v, { status: 'approved' }, 'Design approved')}><CheckCheck /> Approve</Button>
                      </>
                    )}
                    {(isManager || sales) && approved && (
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
                      {files.map(f => <Button key={f.id} variant="outline" size="sm" title={sales && approved ? 'Download' : 'Open'} onClick={() => void openDesignFile(f.id, 'design')}>{sales && approved ? <Download /> : <FileText />} {f.file_name}</Button>)}
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
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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

// Figma "Design Workspace" job pop-up (node 499:6209).
/** Status chip: 12px label, 14px icon, 4px radius. */
const CHIP = 'h-[22px] gap-1 rounded-[4px] pl-2 pr-2.5 text-[12px] leading-4 [&_svg]:size-3.5';
/** General Info inputs: 42px, white fill, 6px radius, 14px semibold. */
const INPUT_CLS = 'h-[42px] rounded-[6px] border-ui-input-border bg-ui-input-bg px-3 text-[14px] font-semibold tracking-[-0.308px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading';
/** Underline tabs: 48px row, 3px active border. */
const TAB_CLS = 'h-full min-w-0 shrink-0 border-b-[3px] border-transparent bg-transparent px-0 text-[13px] leading-[1.4] text-ui-text-secondary hover:bg-transparent hover:text-[var(--color-secondary-700)] dark:bg-transparent dark:hover:bg-transparent dark:hover:text-ui-heading data-active:border-[var(--color-secondary-700)] data-active:text-[13px] data-active:font-semibold data-active:text-[var(--color-secondary-700)] dark:data-active:border-ui-heading dark:data-active:text-ui-heading';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-[7px]"><span className="text-[12px] font-medium leading-4 text-ui-body">{label}</span>{children}</div>;
}

function ReadOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('flex h-[42px] items-center rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[14px] font-semibold', HEADING, className)}>{children}</span>;
}

/** White card: 16px title, divider, then content. */
function Card({ title, action, children }: { title: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-page-bg px-3.5 pt-3.5 pb-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn('m-0 text-[16px] font-semibold leading-[1.45]', HEADING)}>{title}</h3>
          {action}
        </div>
        <hr className="m-0 border-0 border-t border-ui-divider" />
      </div>
      {children}
    </section>
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
  const create = (
    <Link href="/design/brands" className="inline-flex h-6 shrink-0 items-center gap-2 rounded-[6px] bg-ui-btn-accent pl-[7px] pr-3 text-[13px] font-medium text-ui-btn-accent-fg no-underline transition-opacity hover:opacity-90">
      <Plus size={16} aria-hidden /> Create New
    </Link>
  );
  return (
    <Card title="Brand Kit" action={create}>
      {kits === null ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p>
      ) : kits.length === 0 ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">{prospectId ? 'No brand kit for this customer yet — create one with the logo, colours and fonts.' : 'No customer linked to this job yet.'}</p>
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
