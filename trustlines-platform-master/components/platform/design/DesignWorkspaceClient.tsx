'use client';

import { useMemo, useRef, useState } from 'react';
import { Palette, Plus, ExternalLink, ChevronDown, CalendarClock, Paperclip, Box, Upload, FileText, FolderOpen, Send, UserPlus, Users, User, Plug, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Pill } from '@/components/platform/shared/Pill';
import type { SalesDesignJob, SalesDesignVersion } from '@/types/database';
import type { LeadBrief, IntakeFile, DesignFile, ProjectMeta } from '@/app/(platform)/design/page';

interface Props {
  jobs: SalesDesignJob[];
  versions: SalesDesignVersion[];
  leadMap: Record<string, LeadBrief>;
  designerMap: Record<string, string>;
  intakeFiles: Record<string, IntakeFile[]>;
  designFiles: Record<string, DesignFile[]>;
  projectMeta: Record<string, ProjectMeta>;
  isManager: boolean;
  schemaError: string | null;
  designers: { id: string; full_name: string }[];
  projectTeam: Record<string, { trustlinesPm: string | null; tlinesPm: string | null }>;
  creatorMap: Record<string, string>;
}

function anchorId(job: Pick<SalesDesignJob, 'lead_intake_id' | 'opportunity_id'>): string {
  return job.lead_intake_id ?? job.opportunity_id ?? '';
}

function projectName(brief: LeadBrief | undefined, meta: ProjectMeta | undefined, fallback: string): string {
  const who = brief?.customer_name?.trim() || brief?.brand?.trim();
  const where = brief ? [brief.city, brief.state].filter(Boolean).join(', ') : '';
  const label = [who, where].filter(Boolean).join(' · ');
  if (meta?.code && label) return `${meta.code} — ${label}`;
  if (meta?.code) return meta.code;
  return label || fallback;
}

const FILE_CATEGORY_LABELS: Record<string, string> = {
  plan_layout: 'Plan / Layout',
  photos: 'Photos',
  areas_note: 'Areas note',
  client_special_request_note: 'Special request',
  shelving_note: 'Shelving note',
  millwork_note: 'Millwork note',
  image_note: 'Image note',
  ceiling_note: 'Ceiling note',
};

const DESIGNER_STATUSES = ['assigned', 'working_on_it', 'ready_for_sales_review'];
const ALL_STATUSES = [
  'awaiting_assignment', 'assigned', 'working_on_it', 'ready_for_sales_review',
  'revision_requested', 'approved_by_sales', 'presented_to_customer', 'completed', 'cancelled',
];
const VER_STATUSES = ['draft', 'submitted', 'presented', 'approved', 'revision_requested', 'rejected'];

const ACTIVE = new Set(['assigned', 'working_on_it', 'revision_requested']);
const cap = (s: string) => s.replace(/_/g, ' ');

function StatusPill({ status }: { status: string }) {
  const good = ['approved_by_sales', 'completed', 'approved'].includes(status);
  const warn = ['revision_requested', 'rejected', 'cancelled', 'awaiting_assignment'].includes(status);
  return <Pill variant={good ? 'success' : warn ? 'warning' : 'neutral'}><span style={{ textTransform: 'capitalize' }}>{cap(status)}</span></Pill>;
}

export function DesignWorkspaceClient({
  jobs: initialJobs, versions: initialVersions, leadMap, designerMap,
  intakeFiles, designFiles: initialDesignFiles, projectMeta, isManager, schemaError, designers,
  projectTeam, creatorMap,
}: Props) {
  const [jobs, setJobs] = useState<SalesDesignJob[]>(initialJobs);
  const [versions, setVersions] = useState<SalesDesignVersion[]>(initialVersions);
  const [designFiles, setDesignFiles] = useState<Record<string, DesignFile[]>>(initialDesignFiles);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  async function openFile(jobId: string, source: 'intake' | 'design', id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/file-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, id }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok || !b.link) { toast.error(b.error ?? 'Could not open file'); return; }
      window.open(b.link, '_blank', 'noopener,noreferrer');
    } finally { setBusy(false); }
  }

  async function uploadDesignFile(jobId: string, versionId: string, file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/design-jobs/${jobId}/versions/${versionId}/files`, { method: 'POST', body: fd });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Upload failed'); return; }
      setDesignFiles(p => ({ ...p, [versionId]: [...(p[versionId] ?? []), b.file] }));
      toast.success(`${b.file.file_name} uploaded — Sales can see it now`);
    } finally { setBusy(false); }
  }

  const versionsByJob = useMemo(() => {
    const m = new Map<string, SalesDesignVersion[]>();
    for (const v of versions) { const a = m.get(v.job_id) ?? []; a.push(v); m.set(v.job_id, a); }
    return m;
  }, [versions]);

  // 🔴 FIX (Roadmap Month 2, task 11 — "Unassigned Queue"): 'awaiting_assignment' was not in
  // ACTIVE, so a brand-new job with no designer fell into "Everything else" — the LEAST visible
  // bucket, for the one status that most needs a manager's attention. Split it into its own,
  // FIRST section instead of leaving it buried.
  const { unassigned, active, done } = useMemo(() => ({
    unassigned: jobs.filter(j => j.status === 'awaiting_assignment'),
    active: jobs.filter(j => j.status !== 'awaiting_assignment' && ACTIVE.has(j.status)),
    done: jobs.filter(j => j.status !== 'awaiting_assignment' && !ACTIVE.has(j.status)),
  }), [jobs]);

  // Roadmap Month 2, task 14 — "Designer workload": how many open jobs each designer is
  // currently carrying, so a manager can see at a glance who is overloaded before assigning more.
  const workload = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) {
      if (!j.assigned_designer_id || !ACTIVE.has(j.status)) continue;
      m.set(j.assigned_designer_id, (m.get(j.assigned_designer_id) ?? 0) + 1);
    }
    return [...m.entries()].map(([id, count]) => ({ id, name: designerMap[id] ?? 'Designer', count })).sort((a, b) => b.count - a.count);
  }, [jobs, designerMap]);

  async function assignDesigner(jobId: string, designerId: string) {
    if (!designerId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_designer_id: designerId }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not assign'); return; }
      setJobs(p => p.map(j => (j.id === jobId ? b.job : j)));
      toast.success('Assigned — the designer has been notified.');
    } finally { setBusy(false); }
  }

  function toggle(id: string) { setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function patchJob(jobId: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setJobs(p => p.map(j => j.id === jobId ? b.job : j));
      if (b.movedToSupply?.projectId) toast.success(`Design approved — moved to Supply${b.movedToSupply.code ? ` as ${b.movedToSupply.code}` : ''}`);
      else if (b.movedToSupply?.blocked) toast.warning('Design approved — finish Block 1 (region / service / address) to move it to Supply');
      else toast.success('Updated');
    } finally { setBusy(false); }
  }

  async function addVersion(jobId: string, preview_link: string, notes: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/versions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview_link, notes }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setVersions(p => [b.version, ...p]);
      setJobs(p => p.map(j => j.id === jobId && j.status === 'assigned' ? { ...j, status: 'working_on_it' } : j));
      toast.success(`Version V${b.version.version_no} added`);
    } finally { setBusy(false); }
  }

  async function sendReviewLink(jobId: string, versionId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/versions/${versionId}/review-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok || !b.url) { toast.error(b.error ?? 'Could not create the link'); return; }
      try { await navigator.clipboard.writeText(b.url); toast.success('Customer review link copied to clipboard'); }
      catch { toast.success(`Review link: ${b.url}`); }
      setJobs(p => p.map(j => j.id === jobId ? { ...j, status: 'presented_to_customer' } : j));
      setVersions(p => p.map(v => v.id === versionId ? { ...v, status: 'presented' } : v));
    } finally { setBusy(false); }
  }

  async function patchVersion(jobId: string, versionId: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/versions/${versionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Failed'); return; }
      setVersions(p => p.map(v => v.id === versionId ? b.version : v));
      toast.success('Version updated');
    } finally { setBusy(false); }
  }

  function renderJob(job: SalesDesignJob) {
    const jv = versionsByJob.get(job.id) ?? [];
    const open = expanded.has(job.id);
    const statuses = isManager ? ALL_STATUSES : DESIGNER_STATUSES;
    const overdue = job.due_date && new Date(job.due_date) < new Date() && !['completed', 'approved_by_sales'].includes(job.status);
    const anchor = anchorId(job);

    return (
      <div key={job.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', cursor: 'pointer' }} onClick={() => toggle(job.id)}>
          <ChevronDown size={15} style={{ color: 'var(--fg-subtle)', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{projectName(leadMap[anchor], projectMeta[anchor], job.title)}</span>
              <StatusPill status={job.status} />
              {projectMeta[anchor]?.isDraft === true && <span className="pill" style={{ fontSize: 10, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>Opportunity</span>}
              {projectMeta[anchor]?.isDraft === false && <span className="pill" style={{ fontSize: 10, background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>In Supply</span>}
              {job.priority === 'high' && <span style={{ fontSize: 10, color: 'var(--status-danger)', fontWeight: 700 }}>HIGH</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>
              {leadMap[anchor]?.project_type || 'Design'}
              {isManager && job.assigned_designer_id && ` · ${designerMap[job.assigned_designer_id] ?? 'Designer'}`}
              {job.due_date && (
                <span style={{ color: overdue ? 'var(--status-danger)' : 'inherit', marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <CalendarClock size={11} /> {job.due_date}{overdue ? ' · overdue' : ''}
                </span>
              )}
              {' · '}{jv.length} version{jv.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {open && (
          <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* ── Main column ─────────────────────────────────────────── */}
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                {job.brief && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 10 }}>{job.brief}</div>}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Status
                    <select className="form-input" style={{ fontSize: 12, marginTop: 2 }} value={job.status} disabled={busy}
                      onChange={e => patchJob(job.id, { status: e.target.value })}>
                      {(statuses.includes(job.status) ? statuses : [job.status, ...statuses]).map(s => <option key={s} value={s}>{cap(s)}</option>)}
                    </select>
                  </label>
                  {!isManager && (
                    <span style={{ fontSize: 11, color: 'var(--fg-faint)', paddingBottom: 6 }}>
                      Reassignment, priority and due date are managed by Sales.
                    </span>
                  )}
                </div>

                <CustomerBrief
                  brief={leadMap[anchor]}
                  files={intakeFiles[anchor] ?? []}
                  busy={busy}
                  onOpen={fileId => openFile(job.id, 'intake', fileId)}
                />

                <div style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '8px 0 6px' }}>Versions</div>
                {jv.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-faint)', marginBottom: 8 }}>No versions yet — add your first draft below.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {jv.map(v => {
                    const files = designFiles[v.id] ?? [];
                    return (
                      <div key={v.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>V{v.version_no}</span>
                          <StatusPill status={v.status} />
                          {v.preview_link && <a href={v.preview_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Preview <ExternalLink size={11} /></a>}
                          <div style={{ flex: 1 }} />
                          {isManager && (
                            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border-subtle)', fontSize: 12 }}
                              disabled={busy} onClick={() => sendReviewLink(job.id, v.id)}>
                              <Send size={12} /> Customer review link
                            </button>
                          )}
                          <UploadButton busy={busy} onPick={f => uploadDesignFile(job.id, v.id, f)} />
                          <select className="form-input" style={{ fontSize: 12, width: 'auto', padding: '2px 6px' }} value={v.status} disabled={busy}
                            onChange={e => patchVersion(job.id, v.id, { status: e.target.value })} aria-label={`V${v.version_no} status`}>
                            {VER_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                          </select>
                        </div>

                        {files.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {files.map(f => (
                              <button key={f.id} className="btn btn-ghost btn-sm" disabled={busy}
                                style={{ border: '1px solid var(--border-subtle)', fontSize: 12 }}
                                onClick={() => openFile(job.id, 'design', f.id)}>
                                <FileText size={12} /> {f.file_name}
                              </button>
                            ))}
                          </div>
                        )}

                        {v.notes && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 4 }}>{v.notes}</div>}
                        {v.customer_feedback && (
                          <div style={{ fontSize: 12, marginTop: 6, background: 'var(--status-warning-bg, #fef3c7)', color: 'var(--status-warning-fg, #92400e)', borderRadius: 4, padding: '6px 8px' }}>
                            <strong>Feedback:</strong> {v.customer_feedback}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <AddVersionRow busy={busy} onAdd={(link, notes) => addVersion(job.id, link, notes)} />
              </div>

              {/* ── Right sidebar: Team / Integrations / Details ───────────
                  User request, 2026-08-28: mirror the project detail cockpit's side panels here
                  ("dolu dolu" — Team, Integrations/Dropbox, Details), not just a flat form. */}
              <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SidePanel icon={<Users size={13} />} title="Team">
                  <TeamRow label="Designer" name={job.assigned_designer_id ? (designerMap[job.assigned_designer_id] ?? 'Designer') : null} empty="Unassigned" />
                  <TeamRow label="Requested by" name={job.created_by ? (creatorMap[job.created_by] ?? null) : null} empty="—" />
                  <TeamRow label="Trust PM" name={projectTeam[anchor]?.trustlinesPm ?? null} empty="Not assigned yet" />
                  <TeamRow label="Client PM" name={projectTeam[anchor]?.tlinesPm ?? null} empty="Not assigned yet" />
                </SidePanel>

                <SidePanel icon={<Plug size={13} />} title="Integrations">
                  <DesignFolder jobId={job.id} meta={projectMeta[anchor]} />
                </SidePanel>

                <SidePanel icon={<Info size={13} />} title="Details">
                  <DetailRow label="Priority" value={<span style={{ textTransform: 'capitalize' }}>{job.priority}</span>} />
                  <DetailRow label="Due date" value={job.due_date ?? '—'} />
                  <DetailRow label="Created" value={new Date(job.created_at).toLocaleDateString()} />
                  <DetailRow label="Versions" value={String(jv.length)} />
                </SidePanel>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Palette size={20} /> Design projects
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
          {isManager
            ? `${jobs.length} design project${jobs.length !== 1 ? 's' : ''} · designers work in each project’s Dropbox folder, then it moves to Supply`
            : `${active.length} project${active.length !== 1 ? 's' : ''} need your attention`}
        </p>
      </div>

      {schemaError ? (
        <div className="card"><div className="card-body" style={{ fontSize: 13, color: 'var(--status-danger)', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 6 }}>{schemaError}</div></div>
      ) : jobs.length === 0 && unassigned.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <Palette size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>{isManager
            ? 'No design jobs yet. One is created when a lead reaches “Working on it Trust”.'
            : 'Nothing assigned to you yet. Sales will assign you a design job.'}</div>
        </div></div>
      ) : (
        <>
          {isManager && workload.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={13} /> Designer workload
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {workload.map(w => (
                  <div key={w.id} className="pill" style={{ fontSize: 12, background: 'var(--bg-subtle)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span>{w.name}</span>
                    <span style={{ fontWeight: 700, color: w.count >= 3 ? 'var(--status-danger)' : 'inherit' }}>{w.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isManager && unassigned.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-danger)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={13} /> Needs a designer assigned ({unassigned.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unassigned.map(job => {
                  const anchor = anchorId(job);
                  return (
                    <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--status-danger)', borderRadius: 8, background: 'var(--status-danger-bg, #fef2f2)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{projectName(leadMap[anchor], projectMeta[anchor], job.title)}</div>
                        <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{leadMap[anchor]?.project_type || 'Design'} · unassigned</div>
                      </div>
                      <select
                        className="form-input" style={{ fontSize: 12, width: 'auto' }} disabled={busy}
                        defaultValue="" onChange={e => assignDesigner(job.id, e.target.value)}
                        aria-label={`Assign a designer to ${job.title}`}
                      >
                        <option value="" disabled>Assign to…</option>
                        {designers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {active.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Needs attention</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{active.map(renderJob)}</div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Everything else</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{done.map(renderJob)}</div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function DesignFolder({ jobId, meta }: { jobId: string; meta: ProjectMeta | undefined }) {
  const [opening, setOpening] = useState(false);

  if (!meta?.designRoot) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <FolderOpen size={13} style={{ color: 'var(--fg-faint)' }} />
        <div>
          <div style={{ color: 'var(--fg-subtle)' }}>Dropbox</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-faint)' }}>Not set — needs region/service/address on Block 1</div>
        </div>
      </div>
    );
  }
  const folder = meta.designRoot;

  async function openFolder() {
    const win = window.open('', '_blank');
    setOpening(true);
    try {
      const res = await fetch(`/api/design-jobs/${jobId}/ensure-folder`, { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      const root = b.designRoot ?? folder;
      if (!res.ok) { toast.error(b.error ?? 'Could not open the design folder'); win?.close(); return; }
      const url = `https://www.dropbox.com/home${encodeURI(root)}`;
      if (win) win.location.href = url; else window.open(url, '_blank', 'noopener,noreferrer');
      if (b.created) toast.success('Design folder created in Dropbox');
    } finally { setOpening(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <FolderOpen size={13} style={{ color: 'var(--fg-subtle)' }} />
        <span style={{ fontSize: 12, fontWeight: 600 }}>Dropbox</span>
      </div>
      <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, width: '100%', justifyContent: 'center' }} onClick={openFolder} disabled={opening}>
        {opening ? 'Opening…' : <>Open design folder <ExternalLink size={11} /></>}
      </button>
      <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', marginTop: 5 }}>{folder}</div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-faint)', marginTop: 4 }}>
        Under the Design share. Opens/creates the folder tree; work there (Dropbox-synced), then set the version to
        “Ready for sales review.”
      </div>
    </div>
  );
}

function CustomerBrief({ brief, files, busy, onOpen }: {
  brief: LeadBrief | undefined; files: IntakeFile[]; busy: boolean; onOpen: (fileId: string) => void;
}) {
  if (!brief) return null;

  const scope = Object.entries(brief.scope_of_work ?? {}).filter(([, v]) => v).map(([k]) => cap(k));
  const notes = Object.entries(brief.notes ?? {}).filter(([, v]) => (v ?? '').trim());
  const site = [brief.street, brief.city, brief.state].filter(Boolean).join(', ') || brief.address;

  const byCategory = files.reduce<Record<string, IntakeFile[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f); return acc;
  }, {});

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px', margin: '10px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Customer brief — from Sales</div>

      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 6, columnGap: 10, fontSize: 12, marginBottom: 10 }}>
        {([['Customer', brief.customer_name || brief.brand], ['Site', site], ['Project type', brief.project_type]] as [string, string | null][])
          .map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <div style={{ color: 'var(--fg-subtle)' }}>{k}</div>
              <div>{v || <span style={{ color: 'var(--fg-faint)' }}>—</span>}</div>
            </div>
          ))}
        {scope.length > 0 && (
          <>
            <div style={{ color: 'var(--fg-subtle)' }}>Scope</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {scope.map(s => <span key={s} className="pill" style={{ fontSize: 10, textTransform: 'capitalize' }}>{s}</span>)}
            </div>
          </>
        )}
      </div>

      {brief.matterport_link ? (
        <a href={brief.matterport_link} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"
          style={{ fontSize: 12, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Box size={13} /> Open 360 walkthrough <ExternalLink size={11} />
        </a>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginBottom: 10 }}>No Matterport link provided.</div>
      )}

      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Paperclip size={11} /> Customer files ({files.length})
      </div>
      {files.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>Sales hasn’t attached any files to this lead yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat}>
              <div style={{ fontSize: 10, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>
                {FILE_CATEGORY_LABELS[cat] ?? cap(cat)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {list.map(f => (
                  <button key={f.id} className="btn btn-ghost btn-sm" disabled={busy}
                    style={{ border: '1px solid var(--border-subtle)', fontSize: 12, background: 'white' }}
                    onClick={() => onOpen(f.id)}>
                    <FileText size={12} /> {f.file_name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 4 }}>Notes from Sales</div>
          {notes.map(([k, v]) => (
            <div key={k} style={{ fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--fg-subtle)', textTransform: 'capitalize' }}>{cap(k)}:</span> {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadButton({ busy, onPick }: { busy: boolean; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--brand-teal)' }} disabled={busy}
        onClick={() => ref.current?.click()}>
        <Upload size={12} /> Upload design
      </button>
    </>
  );
}

function AddVersionRow({ busy, onAdd }: { busy: boolean; onAdd: (link: string, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  if (!open) return <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, fontSize: 12, color: 'var(--brand-teal)' }} onClick={() => setOpen(true)}><Plus size={12} /> Add version</button>;
  return (
    <div style={{ marginTop: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Preview link (Dropbox / Drive / Matterport)</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder="https://…" value={link} onChange={e => setLink(e.target.value)} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Notes</label>
          <input className="form-input" style={{ fontSize: 13 }} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { onAdd(link.trim(), notes.trim()); setLink(''); setNotes(''); setOpen(false); }}>Add</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function SidePanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ color: 'var(--fg-subtle)', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)' }}>{title}</span>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function TeamRow({ label, name, empty }: { label: string; name: string | null; empty: string }) {
  const initials = (name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '—';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: name ? 'var(--brand-teal, #0d9488)' : 'var(--bg-sunken)',
        color: name ? '#fff' : 'var(--fg-faint)',
        fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {name ? initials : <User size={11} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
        <div style={{ fontSize: 12, color: name ? 'var(--fg-default)' : 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name ?? empty}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--fg-subtle)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
