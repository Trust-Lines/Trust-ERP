'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, CircleDollarSign, Download, FolderKanban, PackageCheck, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  getProject, getProjects, mapBackendProjectToFrontend, mapBackendProjectsToSections, updateProjectItem,
  type ApiProject, type ApiRow, type ApiSection, type UpdateProjectItemRequest,
} from '@/modules/trust-projects/lib/projects';
import { useColumnPermissions } from '@/modules/trust-projects/hooks/useColumnPermissions';
import { useSocket } from '@/modules/trust-projects/contexts/SocketContext';
import { Select } from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/platform/shared/StatCard';
import { cn } from '@/lib/utils';
import { ProjectCard, type SaveItem } from './ProjectCard';
import { DONE_STATUSES, FILTER_CLS, ITEM_STATUSES, REGION_TONE, toNumber, usd } from './boardShared';

const LIVE_EVENTS = ['project:updated', 'project:created', 'project:deleted', 'project-item:created', 'project-item:deleted', 'entity:patched'];

/**
 * Operations / Production → Projects board: the Trust System projects (live, through /api/trust),
 * shown with T-ERP's design system. Business rules (PF codes, status dates, totals) stay on the
 * Trust System — this sends a change and shows what comes back.
 */
export function ProjectsBoard({ canEdit }: { canEdit: boolean }) {
  const [sections, setSections] = useState<ApiSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('');
  const [vendor, setVendor] = useState('');
  const [type, setType] = useState('');
  const [half, setHalf] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { isColumnVisible, isColumnEditable } = useColumnPermissions();

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await getProjects();
      setSections(mapBackendProjectsToSections(res.data));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the projects');
    } finally { setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Live updates: someone edits in the Trust System (or another tab) → reload, debounced so a burst
  // of events costs one reload (the API allows 200 requests a minute).
  const { socket, joinRooms, leaveRooms } = useSocket();
  useEffect(() => { joinRooms(['projects']); return () => leaveRooms(['projects']); }, [joinRooms, leaveRooms]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void load(true); }, 1500);
  }, [load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!socket) return;
    for (const ev of LIVE_EVENTS) socket.on(ev, scheduleReload);
    return () => { for (const ev of LIVE_EVENTS) socket.off(ev, scheduleReload); };
  }, [socket, scheduleReload]);

  /** Send one field change, then show the project as the Trust System returns it. */
  const saveItem: SaveItem = useCallback(async (row, patch, label) => {
    if (!row.itemId) return;
    const projectId = (sections ?? []).flatMap(s => s.projects).find(p => p.rows.some(r => r.itemId === row.itemId))?.projectId;
    try {
      await updateProjectItem(row.itemId, patch as UpdateProjectItemRequest);
      if (projectId) {
        const fresh = mapBackendProjectToFrontend(await getProject(projectId));
        setSections(prev => (prev ?? []).map(s => ({ ...s, projects: s.projects.map(p => (p.projectId === projectId ? fresh : p)) })));
      }
      toast.success(label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The Trust System refused the change');
    }
  }, [sections]);

  // Filter options come from the whole data set.
  const all = useMemo(() => (sections ?? []).flatMap(s => s.projects), [sections]);
  const vendors = useMemo(() => [...new Set(all.flatMap(p => p.rows.map(r => r.vendor)).filter(Boolean))].sort(), [all]);
  const types = useMemo(() => [...new Set(all.flatMap(p => p.rows.map(r => r.type)).filter(Boolean))], [all]);
  const halves = useMemo(() => [...new Set(all.filter(p => p.halfOfYear && p.halfYear).map(p => `${p.halfYear}:${p.halfOfYear}`))].sort(), [all]);

  const rowFilter = useCallback((r: ApiRow) => (!status || r.status === status) && (!vendor || r.vendor === vendor) && (!type || r.type === type), [status, vendor, type]);
  const rowFiltered = !!(status || vendor || type);
  const view = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (sections ?? []).filter(sec => !region || sec.id === region).map(sec => ({
      ...sec,
      projects: sec.projects.flatMap(p => {
        if (urgentOnly && !p.isUrgent) return [];
        if (half && `${p.halfYear}:${p.halfOfYear}` !== half) return [];
        if (s && !`${p.projectNumber} ${p.projectName} ${p.address} ${p.rows.map(r => `${r.pfCode} ${r.vendor} ${r.containerNo}`).join(' ')}`.toLowerCase().includes(s)) return [];
        const rows = rowFiltered ? p.rows.filter(rowFilter) : p.rows;
        return rowFiltered && !rows.length ? [] : [{ project: p, rows }];
      }),
    }));
  }, [sections, q, region, half, urgentOnly, rowFilter, rowFiltered]);

  const stats = useMemo(() => {
    const rows = view.flatMap(s => s.projects.flatMap(p => p.rows));
    return {
      projects: view.reduce((n, s) => n + s.projects.length, 0),
      open: rows.filter(r => !DONE_STATUSES.has(r.status)).length,
      notOrdered: rows.filter(r => r.status === 'NOT ORDERED').length,
      toReceive: rows.filter(r => r.status === 'READY TO RECEIVE').length,
      openUsd: rows.filter(r => !DONE_STATUSES.has(r.status)).reduce((t, r) => t + toNumber(r.pfUsd), 0),
    };
  }, [view]);

  async function exportExcel() {
    const { exportProjectsAllTabsToExcel } = await import('@/modules/trust-projects/utils/excel/exportProjectsAllTabsExcel');
    const filtered: ApiSection[] = view.map(s => ({ id: s.id, label: s.label, projects: s.projects.map(x => ({ ...x.project, rows: x.rows })) as ApiProject[] }));
    await exportProjectsAllTabsToExcel({ projectsSections: filtered, isColumnVisible, filename: `Operational_Board_${new Date().toISOString().slice(0, 10)}.xlsx` });
  }

  const anyFilter = !!(q || region || status || vendor || type || half || urgentOnly);
  const clear = () => { setQ(''); setRegion(''); setStatus(''); setVendor(''); setType(''); setHalf(''); setUrgentOnly(false); };

  if (error && !sections) {
    return (
      <div className="rounded-[8px] bg-ui-surface p-5">
        <EmptyState icon={<TriangleAlert />} title="Could not load the projects" description={error}
          action={<Button size="sm" onClick={() => void load()}><RefreshCw /> Try again</Button>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projects" value={stats.projects} />
        <StatCard icon={TriangleAlert} label="Lines not ordered" value={stats.notOrdered}
          active={status === 'NOT ORDERED'} onClick={() => setStatus(s => (s === 'NOT ORDERED' ? '' : 'NOT ORDERED'))} />
        <StatCard icon={PackageCheck} label="Ready to receive" value={stats.toReceive}
          active={status === 'READY TO RECEIVE'} onClick={() => setStatus(s => (s === 'READY TO RECEIVE' ? '' : 'READY TO RECEIVE'))} />
        {isColumnVisible('pfUsd') && <StatCard icon={CircleDollarSign} label="Open PF (USD)" value={usd(stats.openUsd)} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-[285px] max-w-full">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input type="search" aria-label="Search projects" placeholder="Project no, name, PF code, vendor, container…" value={q} onChange={e => setQ(e.target.value)}
              className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring" />
          </div>
          <Select aria-label="Region" className={FILTER_CLS} value={region} onValueChange={v => setRegion(v ?? '')}
            options={[{ value: '', label: 'All regions' }, ...(sections ?? []).map(s => ({ value: s.id, label: s.label }))]} />
          <Select aria-label="Status" className={FILTER_CLS} value={status} onValueChange={v => setStatus(v ?? '')}
            options={[{ value: '', label: 'Status' }, ...ITEM_STATUSES.map(s => ({ value: s, label: s }))]} />
          <Select aria-label="Vendor" className={FILTER_CLS} value={vendor} onValueChange={v => setVendor(v ?? '')}
            options={[{ value: '', label: 'Vendor' }, ...vendors.map(v => ({ value: v, label: v }))]} />
          <Select aria-label="Type" className={FILTER_CLS} value={type} onValueChange={v => setType(v ?? '')}
            options={[{ value: '', label: 'Type' }, ...types.map(t => ({ value: t, label: t }))]} />
          {halves.length > 0 && (
            <Select aria-label="Half" className={FILTER_CLS} value={half} onValueChange={v => setHalf(v ?? '')}
              options={[{ value: '', label: 'Half' }, ...halves.map(h => { const [y, hf] = h.split(':'); return { value: h, label: `${hf === 'FIRST_HALF' ? 'H1' : 'H2'} ${y}` }; })]} />
          )}
          <button type="button" aria-pressed={urgentOnly} onClick={() => setUrgentOnly(u => !u)}
            className={cn(FILTER_CLS, 'px-3 aria-pressed:border-[var(--color-secondary-700)] aria-pressed:bg-ui-selected-bg dark:aria-pressed:border-ui-heading')}>
            Urgent only
          </button>
          {anyFilter && <button type="button" onClick={clear} className="border-0 bg-transparent px-1 text-[13px] font-medium text-ui-link hover:underline">Clear filters</button>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={refreshing} aria-label="Reload"><RefreshCw className={refreshing ? 'animate-spin' : undefined} /></Button>
          <Button variant="outline" size="sm" onClick={() => void exportExcel()} disabled={!sections}><Download /> Export Excel</Button>
          <Link href="/production?view=classic" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Classic board</Link>
        </div>
      </div>

      {sections === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading projects from the Trust System…</p> : (
        view.map(sec => {
          if (!sec.projects.length && anyFilter) return null;
          const isCollapsed = collapsed.has(sec.id);
          const tone = REGION_TONE[sec.id] ?? 't0';
          return (
            <section key={sec.id} className="flex flex-col gap-3">
              <button type="button" aria-expanded={!isCollapsed}
                onClick={() => setCollapsed(c => { const n = new Set(c); if (n.has(sec.id)) n.delete(sec.id); else n.add(sec.id); return n; })}
                className="flex items-center gap-2 rounded-[8px] border-0 px-3 py-2.5 text-left"
                style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>
                {isCollapsed ? <ChevronRight size={20} aria-hidden /> : <ChevronDown size={20} aria-hidden />}
                <span className="text-[16px] font-semibold">{sec.label}</span>
                <span className="text-[13px]">({sec.projects.length})</span>
              </button>
              {!isCollapsed && (sec.projects.length === 0
                ? <p className="m-0 px-3 text-[13px] text-ui-text-secondary">No projects in this region.</p>
                : sec.projects.map(({ project, rows }) => (
                  <ProjectCard key={project.projectId} project={project} rows={rows} canEdit={canEdit}
                    visible={isColumnVisible} editable={isColumnEditable} onSave={saveItem} />
                )))}
            </section>
          );
        })
      )}
      {sections && stats.projects === 0 && anyFilter && (
        <div className="rounded-[8px] bg-ui-surface p-5"><EmptyState icon={<Search />} title="No matching projects" description="Try another search or filter." /></div>
      )}
      <p className="m-0 text-[11px] text-ui-text-secondary">
        Live Trust System data. Vendor, order type, rows, projects, containers, payment rules, groups and stock are still edited on the <Link href="/production?view=classic" className="text-ui-link">Classic board</Link>.
      </p>
    </div>
  );
}
