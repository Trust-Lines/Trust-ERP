'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Eye, Hourglass, Layers, Palette, Search, Send, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { SalesDesignJob, SalesDesignVersion } from '@/types/database';
import type { LeadBrief, IntakeFile, DesignFile, ProjectMeta } from '@/app/(platform)/design/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/platform/shared/StatCard';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { DesignJobSheet } from './DesignJobSheet';
import {
  DESIGNER_STATUSES, FILTER_CLS, HEADING, JOB_STATUS_LABEL, JOB_STATUS_ORDER, OPEN_STATUSES,
  anchorId, initials, localYmd, projectName,
} from './designShared';

interface Props {
  currentUserId: string;
  initialJobId: string | null;
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

type TabKey = 'jobs' | 'board' | 'team';
type Scope = 'open' | 'review' | 'done' | 'all';

const BOARD_COLUMNS = JOB_STATUS_ORDER.filter(s => s !== 'cancelled');

export function DesignWorkspace(props: Props) {
  const { currentUserId, initialJobId, leadMap, designerMap, projectMeta, isManager, schemaError, designers } = props;
  const [jobs, setJobs] = useState<SalesDesignJob[]>(props.jobs);
  const [versions, setVersions] = useState<SalesDesignVersion[]>(props.versions);
  const [designFiles, setDesignFiles] = useState<Record<string, DesignFile[]>>(props.designFiles);
  const [openId, setOpenId] = useState<string | null>(initialJobId && props.jobs.some(j => j.id === initialJobId) ? initialJobId : null);
  const [tab, setTab] = useState<TabKey>('jobs');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('open');
  const [fDesigner, setFDesigner] = useState('');
  // Set after mount: the server renders in UTC, so "overdue" would differ from the browser's day.
  const [today, setToday] = useState('');
  useEffect(() => { setToday(localYmd()); }, []);

  const versionsByJob = useMemo(() => {
    const m = new Map<string, SalesDesignVersion[]>();
    for (const v of versions) m.set(v.job_id, [...(m.get(v.job_id) ?? []), v]);
    for (const list of m.values()) list.sort((a, b) => b.version_no - a.version_no);
    return m;
  }, [versions]);

  const nameOf = (j: SalesDesignJob) => { const a = anchorId(j); return projectName(leadMap[a], projectMeta[a], j.title); };
  const isOverdue = (j: SalesDesignJob) => !!today && !!j.due_date && j.due_date.slice(0, 10) < today && OPEN_STATUSES.has(j.status);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter(j => {
      if (scope === 'open' && !OPEN_STATUSES.has(j.status)) return false;
      if (scope === 'review' && !['ready_for_sales_review', 'approved_by_sales', 'presented_to_customer'].includes(j.status)) return false;
      if (scope === 'done' && OPEN_STATUSES.has(j.status)) return false;
      if (fDesigner === '__none__' && j.assigned_designer_id) return false;
      if (fDesigner && fDesigner !== '__none__' && j.assigned_designer_id !== fDesigner) return false;
      if (q) {
        const a = anchorId(j);
        const hay = `${nameOf(j)} ${j.title} ${leadMap[a]?.project_type ?? ''} ${designerMap[j.assigned_designer_id ?? ''] ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.created_at.localeCompare(a.created_at));
  }, [jobs, search, scope, fDesigner, leadMap, projectMeta, designerMap]);

  const counts = useMemo(() => ({
    open: jobs.filter(j => OPEN_STATUSES.has(j.status)).length,
    unassigned: jobs.filter(j => j.status === 'awaiting_assignment').length,
    review: jobs.filter(j => j.status === 'ready_for_sales_review').length,
    customer: jobs.filter(j => j.status === 'presented_to_customer').length,
  }), [jobs]);

  const workload = useMemo(() => {
    const m = new Map<string, { open: number; overdue: number }>();
    for (const d of designers) m.set(d.id, { open: 0, overdue: 0 });
    for (const j of jobs) {
      if (!j.assigned_designer_id || !OPEN_STATUSES.has(j.status)) continue;
      const cur = m.get(j.assigned_designer_id) ?? { open: 0, overdue: 0 };
      cur.open += 1;
      if (isOverdue(j)) cur.overdue += 1;
      m.set(j.assigned_designer_id, cur);
    }
    return [...m].map(([id, w]) => ({ id, name: designerMap[id] ?? 'Designer', ...w })).sort((a, b) => b.open - a.open);
  }, [jobs, designers, designerMap, today]);

  async function patchJob(job: SalesDesignJob, patch: Record<string, unknown>, okMessage = 'Saved') {
    const before = job;
    setJobs(p => p.map(j => (j.id === job.id ? { ...j, ...patch } as SalesDesignJob : j)));
    try {
      const res = await fetch(`/api/design-jobs/${job.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not save');
      setJobs(p => p.map(j => (j.id === job.id ? { ...j, ...b.job } : j)));
      if (b.movedToSupply?.projectId) toast.success(`Design approved — moved to Supply${b.movedToSupply.code ? ` as ${b.movedToSupply.code}` : ''}`);
      else if (b.movedToSupply?.blocked) toast.warning('Design approved — finish Block 1 (region / service / address) to move it to Supply');
      else toast.success(okMessage);
    } catch (e) {
      setJobs(p => p.map(j => (j.id === job.id ? before : j)));
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  }

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  function dropOn(status: string) {
    const job = jobs.find(j => j.id === dragId);
    setDragId(null); setOverCol(null);
    if (!job || job.status === status) return;
    if (!isManager && !DESIGNER_STATUSES.includes(status)) {
      toast.error(`Only Sales can move a job to “${JOB_STATUS_LABEL[status]}”`);
      return;
    }
    void patchJob(job, { status }, `Moved to ${JOB_STATUS_LABEL[status]}`);
  }

  const openJob = jobs.find(j => j.id === openId) ?? null;
  // Keep the URL shareable (?job=…) without a navigation.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (openId) url.searchParams.set('job', openId); else url.searchParams.delete('job');
      window.history.replaceState(null, '', url);
    } catch { /* ignore */ }
  }, [openId]);

  if (schemaError) {
    return <div className="rounded-[8px] border border-error-normal bg-error-light p-4 text-[13px] text-error-dark">{schemaError}</div>;
  }

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <p className="m-0 text-[11px] font-semibold text-ui-nav-active">Design / Workspace</p>
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Design</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {isManager
            ? `${counts.open} open design job${counts.open === 1 ? '' : 's'} · notes, files and versions are shared with Sales`
            : `${counts.open} job${counts.open === 1 ? '' : 's'} on your desk`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Layers} label="Open jobs" value={counts.open} active={scope === 'open' && tab === 'jobs'} onClick={() => { setTab('jobs'); setScope('open'); setFDesigner(''); }} />
        {isManager
          ? <StatCard icon={Hourglass} label="Awaiting designer" value={counts.unassigned} active={tab === 'team'} onClick={() => setTab('team')} />
          : <StatCard icon={CalendarClock} label="Overdue" value={jobs.filter(isOverdue).length} />}
        <StatCard icon={Eye} label="In Sales review" value={counts.review} active={scope === 'review' && tab === 'jobs'} onClick={() => { setTab('jobs'); setScope('review'); }} />
        <StatCard icon={Send} label="With customer" value={counts.customer} />
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabKey)} className="gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="jobs">{isManager ? 'All jobs' : 'My work'}</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            {isManager && <TabsTrigger value="team">Team{counts.unassigned ? ` · ${counts.unassigned}` : ''}</TabsTrigger>}
          </TabsList>
          {tab !== 'team' && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-[260px] max-w-full">
                <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
                <input
                  type="search" aria-label="Search design jobs" placeholder="Search customer, type, designer…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
                />
              </div>
              {tab === 'jobs' && (
                <Select aria-label="Show" className={FILTER_CLS} value={scope} onValueChange={v => setScope((v ?? 'open') as Scope)}
                  options={[{ value: 'open', label: 'Open' }, { value: 'review', label: 'Review & customer' }, { value: 'done', label: 'Finished' }, { value: 'all', label: 'All' }]} />
              )}
              {isManager && (
                <Select aria-label="Designer" className={FILTER_CLS} value={fDesigner} onValueChange={v => setFDesigner(v ?? '')}
                  options={[{ value: '', label: 'All designers' }, { value: '__none__', label: 'Unassigned' }, ...designers.map(d => ({ value: d.id, label: d.full_name }))]} />
              )}
            </div>
          )}
        </div>

        {/* ── My work / All jobs ── */}
        <TabsContent value="jobs">
          {visible.length === 0 ? (
            <div className="rounded-[8px] bg-ui-surface p-5">
              <EmptyState
                icon={<Palette />}
                title={jobs.length === 0 ? (isManager ? 'No design jobs yet' : 'Nothing assigned to you yet') : 'No matching jobs'}
                description={jobs.length === 0
                  ? 'A design job starts when a deal reaches “Working on it Trust” in the CRM or Sales presses “Start Design”.'
                  : 'Try another filter.'}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 rounded-[8px] bg-ui-surface p-5">
              {visible.map(j => {
                const a = anchorId(j);
                const latest = versionsByJob.get(j.id)?.[0];
                const designer = j.assigned_designer_id ? designerMap[j.assigned_designer_id] : null;
                return (
                  <button
                    key={j.id} type="button" onClick={() => setOpenId(j.id)}
                    className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-[6px] border-0 bg-ui-surface-elevated px-5 py-3 text-left transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
                  >
                    <div className="flex min-w-[220px] flex-1 flex-col gap-[3px]">
                      <span className={cn('text-[13px] font-semibold leading-[1.4]', HEADING)}>{nameOf(j)}</span>
                      <span className="text-[11px] text-ui-text-secondary">
                        {leadMap[a]?.project_type || 'Design'}
                        {j.priority === 'high' && <span className="ml-2 font-semibold text-error-normal">High priority</span>}
                        {projectMeta[a]?.isDraft === false && <span className="ml-2">· In Supply</span>}
                      </span>
                    </div>
                    <StatusBadge group="design_job" status={j.status} size="sm" />
                    <span className="flex w-[160px] items-center gap-2 text-[12px] text-ui-body">
                      <span aria-hidden className={cn('grid size-[24px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold', HEADING)}>{initials(designer)}</span>
                      <span className="truncate">{designer ?? 'Unassigned'}</span>
                    </span>
                    <span className={cn('w-[110px] text-[12px]', isOverdue(j) ? 'font-semibold text-error-normal' : 'text-ui-body')}>
                      {j.due_date ? `Due ${formatDate(j.due_date)}` : 'No due date'}
                    </span>
                    <span className="w-[120px] text-[12px] text-ui-text-secondary">
                      {latest ? `V${latest.version_no} · ${latest.status === 'submitted' ? 'sent to Sales' : latest.status.replace(/_/g, ' ')}` : 'No version yet'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Board ── */}
        <TabsContent value="board">
          <div className="flex items-start gap-3 overflow-x-auto pb-2">
            {BOARD_COLUMNS.map(status => {
              const cards = visible.filter(j => j.status === status);
              const over = overCol === status && dragId != null;
              const allowed = isManager || DESIGNER_STATUSES.includes(status);
              return (
                <div
                  key={status}
                  onDragOver={e => { if (dragId && allowed) { e.preventDefault(); if (overCol !== status) setOverCol(status); } }}
                  onDragLeave={() => setOverCol(c => (c === status ? null : c))}
                  onDrop={e => { e.preventDefault(); dropOn(status); }}
                  className={cn('flex w-[260px] shrink-0 flex-col rounded-[8px] border bg-ui-surface transition-colors', over ? 'border-[var(--color-secondary-700)] dark:border-ui-heading' : 'border-ui-divider')}
                >
                  <div className="flex items-center gap-2 border-b border-ui-divider px-3 py-2.5">
                    <StatusBadge group="design_job" status={status} size="sm" />
                    <span className="text-[12px] font-semibold text-ui-text-secondary">{cards.length}</span>
                  </div>
                  <div className="flex min-h-[70px] flex-col gap-2 p-2">
                    {cards.length === 0 && <p className="m-0 py-4 text-center text-[12px] italic text-ui-text-secondary">{over ? 'Drop here' : '—'}</p>}
                    {cards.map(j => {
                      const designer = j.assigned_designer_id ? designerMap[j.assigned_designer_id] : null;
                      return (
                        <div
                          key={j.id} role="button" tabIndex={0} draggable
                          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', j.id); setDragId(j.id); }}
                          onDragEnd={() => { setDragId(null); setOverCol(null); }}
                          onClick={() => setOpenId(j.id)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(j.id); } }}
                          className={cn('cursor-grab rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-3 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring', dragId === j.id && 'opacity-50')}
                        >
                          <p className={cn('m-0 text-[13px] font-semibold leading-[1.35]', HEADING)}>{nameOf(j)}</p>
                          <p className="m-0 mt-0.5 text-[11px] text-ui-text-secondary">{leadMap[anchorId(j)]?.project_type || 'Design'}</p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                            <span className="flex min-w-0 items-center gap-1.5 text-ui-body">
                              <span aria-hidden className={cn('grid size-[20px] shrink-0 place-items-center rounded-full bg-ui-surface text-[9px] font-semibold', HEADING)}>{initials(designer)}</span>
                              <span className="truncate">{designer ?? 'Unassigned'}</span>
                            </span>
                            {j.due_date && <span className={isOverdue(j) ? 'font-semibold text-error-normal' : 'text-ui-text-secondary'}>{formatDate(j.due_date)}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Team (managers) ── */}
        {isManager && (
          <TabsContent value="team">
            <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
              <section className="flex flex-col gap-3 rounded-[8px] bg-ui-surface p-5">
                <h2 className={cn('m-0 flex items-center gap-2 text-[15px] font-semibold', HEADING)}><UserPlus size={16} aria-hidden /> Needs a designer ({counts.unassigned})</h2>
                {counts.unassigned === 0 ? (
                  <p className="m-0 text-[13px] text-ui-text-secondary">Every open job has a designer.</p>
                ) : jobs.filter(j => j.status === 'awaiting_assignment').map(j => (
                  <div key={j.id} className="flex flex-wrap items-center gap-3 rounded-[6px] bg-ui-surface-elevated px-4 py-3">
                    <button type="button" onClick={() => setOpenId(j.id)} className="min-w-[200px] flex-1 border-0 bg-transparent p-0 text-left">
                      <span className={cn('block text-[13px] font-semibold', HEADING)}>{nameOf(j)}</span>
                      <span className="text-[11px] text-ui-text-secondary">{leadMap[anchorId(j)]?.project_type || 'Design'} · created {formatDate(j.created_at)}</span>
                    </button>
                    <Select
                      aria-label={`Assign a designer to ${nameOf(j)}`} className="w-[200px]" placeholder="Assign to…"
                      value={null} onValueChange={v => { if (v) void patchJob(j, { assigned_designer_id: v }, 'Assigned — the designer has been notified'); }}
                      options={designers.map(d => ({ value: d.id, label: d.full_name }))}
                    />
                  </div>
                ))}
              </section>
              <section className="flex flex-col gap-3 rounded-[8px] bg-ui-surface p-5">
                <h2 className={cn('m-0 text-[15px] font-semibold', HEADING)}>Workload</h2>
                {workload.length === 0 && <p className="m-0 text-[13px] text-ui-text-secondary">No active designers.</p>}
                {workload.map(w => (
                  <button
                    key={w.id} type="button" onClick={() => { setTab('jobs'); setScope('open'); setFDesigner(w.id); }}
                    className="flex items-center gap-3 rounded-[6px] border-0 bg-ui-surface-elevated px-4 py-2.5 text-left hover:bg-ui-hover-bg"
                  >
                    <span aria-hidden className={cn('grid size-[28px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold', HEADING)}>{initials(w.name)}</span>
                    <span className={cn('flex-1 truncate text-[13px]', HEADING)}>{w.name}</span>
                    <span className={cn('text-[13px] font-semibold', w.open >= 3 ? 'text-error-normal' : 'text-ui-body')}>{w.open} open</span>
                    {w.overdue > 0 && <span className="text-[12px] text-error-normal">{w.overdue} overdue</span>}
                  </button>
                ))}
              </section>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {openJob && (
        <DesignJobSheet
          job={openJob}
          name={nameOf(openJob)}
          currentUserId={currentUserId}
          isManager={isManager}
          designers={designers}
          designerMap={designerMap}
          brief={leadMap[anchorId(openJob)]}
          intakeFiles={props.intakeFiles[anchorId(openJob)] ?? []}
          meta={projectMeta[anchorId(openJob)]}
          team={props.projectTeam[anchorId(openJob)]}
          requestedBy={openJob.created_by ? props.creatorMap[openJob.created_by] ?? null : null}
          versions={versionsByJob.get(openJob.id) ?? []}
          designFiles={designFiles}
          today={today}
          onPatchJob={(patch, msg) => patchJob(openJob, patch, msg)}
          onJobLocal={patch => setJobs(p => p.map(j => (j.id === openJob.id ? { ...j, ...patch } as SalesDesignJob : j)))}
          onVersions={list => setVersions(p => [...list, ...p.filter(v => v.job_id !== openJob.id)])}
          onVersion={v => setVersions(p => p.map(x => (x.id === v.id ? v : x)))}
          onDesignFiles={(versionId, files) => setDesignFiles(p => ({ ...p, [versionId]: files }))}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
