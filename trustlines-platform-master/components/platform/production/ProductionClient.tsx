'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Filter, FolderOutput, Loader2, Pencil, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { OperationalBoard } from './OperationalBoard';
import { MultiFilter, type FilterOption } from './MultiFilter';
import {
  ManageGroupsModal, QUICK_LABEL, QuickChips, TodoModal, makeQuickMatcher, useProductionFlags, type QuickToken,
} from './ProductionFlags';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { cn } from '@/lib/utils';
import type { ProductionAccess } from '@/lib/production/access';
import { STATUS_OPTIONS, normalizeStatus } from '@/lib/production/statuses';
import {
  DEFAULT_VISIBLE_COLUMNS, TYPE_ORDER, buildSectionsFromProjects, exportBoardSheet, exportProjectsWorkbook,
  type PItem, type PProject, type PSection,
} from '@/lib/excel/projectsExcelExport';

const TABS = ['Projects', 'Missing Extra', 'Direct Orders'] as const;
type Tab = typeof TABS[number];
const TAB_KIND: Record<Tab, 'project' | 'missing_extra' | 'direct_order'> = { 'Projects': 'project', 'Missing Extra': 'missing_extra', 'Direct Orders': 'direct_order' };

const PROJECT_TOTAL_RATE = 41.23;

type BoardData = Record<Tab, PProject[]>;
const EMPTY: BoardData = { 'Projects': [], 'Direct Orders': [], 'Missing Extra': [] };

// Trust System filter bar: every filter is row based and they combine with AND; picks inside one
// filter are OR. Half is per project. A project with no rows left is hidden. Nothing is saved.
type FilterKey = 'vendor' | 'type' | 'status' | 'container' | 'half';
const FILTER_LABEL: Record<FilterKey, string> = { vendor: 'Vendor', type: 'Type', status: 'Status', container: 'Container', half: 'Half' };
const noFilters = (): Record<FilterKey, Set<string>> => ({ vendor: new Set(), type: new Set(), status: new Set(), container: new Set(), half: new Set() });
// Quick chips that exist on the Projects tab only.
const PROJECTS_ONLY: QuickToken[] = ['TODO', 'FOLLOWUP', 'GROUPS'];

const halfToken = (p: PProject) => (p.halfOfYear && p.halfYear ? `${p.halfYear}:${p.halfOfYear}` : 'UNASSIGNED');
const halfLabel = (t: string) => (t === 'UNASSIGNED' ? 'Unassigned' : `${t.split(':')[0]} ${t.endsWith('FIRST_HALF') ? 'First Half' : 'Second Half'}`);
const containerKey = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();
const statusLabel = new Map(STATUS_OPTIONS.map(o => [o.value, o.label]));

export function ProductionClient({ access, canAddProject = false }: { access: ProductionAccess; canAddProject?: boolean }) {
  // Tabs the role may open (Roles page → Production Board).
  const tabs = TABS.filter(t => (t === 'Projects' ? access.tabProjects : t === 'Missing Extra' ? access.tabMissingExtra : access.tabDirectOrders));
  const [activeTab, setActiveTab] = useState<Tab>(tabs[0] ?? 'Projects');
  const [exporting, setExporting] = useState(false);
  const [data, setData]   = useState<BoardData | null>(null);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(noFilters);
  const [quick, setQuick] = useState<Set<QuickToken>>(new Set());
  const [todoOpen, setTodoOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; code: string | null; name: string }[]>([]);
  // Half toolbar: selected projects / cases (by id), the year to assign.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [halfBusy, setHalfBusy] = useState(false);
  const [halfError, setHalfError] = useState('');
  const pf = useProductionFlags();
  const projectsTab = activeTab === 'Projects';
  const toggleQuick = (t: QuickToken) => setQuick(prev => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n; });

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/production/board', { cache: 'no-store' });
      const json = await res.json() as { projects?: PProject[]; directOrders?: PProject[]; missingExtra?: PProject[] };
      setData({
        'Projects':      json.projects     ?? [],
        'Direct Orders': json.directOrders ?? [],
        'Missing Extra': json.missingExtra ?? [],
      });
    } catch {
      setData(EMPTY);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void fetch('/api/production/vendors').then(r => (r.ok ? r.json() : null)).then(r => { if (r?.vendors) setVendors(r.vendors); }).catch(() => {});
  }, []);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);

  const sectionsByTab = useMemo(() => ({
    'Projects':      buildSectionsFromProjects((data ?? EMPTY)['Projects']),
    'Direct Orders': buildSectionsFromProjects((data ?? EMPTY)['Direct Orders']),
    'Missing Extra': buildSectionsFromProjects((data ?? EMPTY)['Missing Extra']),
  } satisfies Record<Tab, PSection[]>), [data]);

  async function handleExport() {
    setExporting(true);
    const date = new Date().toISOString().slice(0, 10);
    const visibleColumns = access.viewMoney && access.viewPf ? undefined : DEFAULT_VISIBLE_COLUMNS.filter(c =>
      (access.viewMoney || !['pfUsd', 'pfTl', 'invoice', 'invoiceTl'].includes(c)) && (access.viewPf || (c !== 'pfCode' && c !== 'pfSignStatus')));
    try {
      if (activeTab === 'Projects') {
        await exportProjectsWorkbook({
          projects:     sectionsByTab['Projects'],
          directOrders: sectionsByTab['Direct Orders'],
          missingExtra: sectionsByTab['Missing Extra'],
          projectTotalRate: PROJECT_TOTAL_RATE,
          filename: `Operational_Board_${date}.xlsx`,
          visibleColumns, skipProjectTotal: !access.viewMoney,
        });
        toast.success(access.viewMoney ? 'Excel exported — 4 sheets (Projects, Missing & Extra, Direct Orders, Project Total)' : 'Excel exported');
      } else if (activeTab === 'Missing Extra') {
        await exportBoardSheet({ sheetName: 'Missing & Extra', sections: sectionsByTab['Missing Extra'], filename: `Missing_Extra_${date}.xlsx`, visibleColumns });
        toast.success('Excel exported');
      } else {
        await exportBoardSheet({ sheetName: 'Direct Orders', sections: sectionsByTab['Direct Orders'], filename: `Direct_Orders_${date}.xlsx`, visibleColumns });
        toast.success('Excel exported');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally { setExporting(false); }
  }

  const tabSections = sectionsByTab[activeTab];
  const tabItems = useMemo(() => tabSections.flatMap(s => s.projects.flatMap(p => p.items || [])), [tabSections]);

  // ── Filter options ──
  const options = useMemo<Record<FilterKey, FilterOption[]>>(() => {
    const custom = [...new Set(tabItems.map(i => i.type ?? '').filter(t => t && !TYPE_ORDER.includes(t)))].sort();
    const containers = new Map<string, string>();
    for (const i of tabItems) { const k = containerKey(i.containerNo); if (k && !containers.has(k)) containers.set(k, String(i.containerNo).trim()); }
    const cNum = (s: string) => { const m = s.match(/^container\s*(\d+)$/i); return m ? Number(m[1]) : null; };
    const containerOpts = [...containers.entries()].sort(([, a], [, b]) => {
      const na = cNum(a), nb = cNum(b);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      return a.localeCompare(b);
    }).map(([value, label]) => ({ value, label }));
    const halves = [...new Set(tabSections.flatMap(s => s.projects.map(halfToken)))].sort((a, b) => (a === 'UNASSIGNED' ? 1 : b === 'UNASSIGNED' ? -1 : a.localeCompare(b)));
    return {
      vendor: vendors.map(v => ({ value: v.id, label: v.code ? `${v.code} - ${v.name}` : v.name })),
      type: [...TYPE_ORDER, ...custom].map(t => ({ value: t, label: t })),
      status: STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label })),
      container: containerOpts,
      half: halves.map(t => ({ value: t, label: halfLabel(t) })),
    };
  }, [tabItems, tabSections, vendors]);

  const activeQuick = useMemo(() => new Set([...quick].filter(t => projectsTab || !PROJECTS_ONLY.includes(t))), [quick, projectsTab]);

  // ── Filtering + search ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const anyFilter = (Object.keys(sel) as FilterKey[]).some(k => sel[k].size) || activeQuick.size;
    let out = tabSections;
    if (anyFilter) {
      const quickOk = makeQuickMatcher(activeQuick, pf.flags, pf.groups);
      const rowOk = (i: PItem) => (
        (!sel.vendor.size || (!!i.vendorId && sel.vendor.has(i.vendorId)))
        && (!sel.type.size || sel.type.has(i.type ?? ''))
        && (!sel.status.size || sel.status.has(normalizeStatus(i.status)))
        && (!sel.container.size || sel.container.has(containerKey(i.containerNo)))
        && quickOk(i)
      );
      out = out.map(s => ({
        ...s,
        projects: s.projects
          .filter(p => !sel.half.size || sel.half.has(halfToken(p)))
          .map(p => ({ ...p, items: (p.items || []).filter(rowOk) }))
          .filter(p => p.items.length > 0),
      }));
    }
    // Search: project number only — exact, then "starts with", then "contains"; regions stay.
    if (q) {
      const rank = (p: PProject) => { const n = String(p.projectNo).toLowerCase(); return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : -1; };
      out = out.map(s => ({
        ...s,
        projects: s.projects.map((p, i) => ({ p, r: rank(p), i })).filter(x => x.r >= 0).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.p),
      }));
    }
    return out;
  }, [tabSections, search, sel, activeQuick, pf.flags, pf.groups]);

  // ── Groups view: bands per PF group, projects by rank, only the group's types ──
  const grouped = projectsTab && activeQuick.has('GROUPS');
  const { sections, groupRanks } = useMemo(() => {
    const ranks = new Map<string, number>();
    if (!grouped) return { sections: filtered, groupRanks: ranks };
    const byId = new Map(filtered.flatMap(s => s.projects).filter(p => p.id).map(p => [p.id!, p]));
    const out: PSection[] = [...pf.groups].sort((a, b) => a.number - b.number).map(g => {
      const order: string[] = [];
      const types = new Map<string, Set<string>>();
      for (const m of [...g.members].sort((a, b) => a.rank - b.rank)) {
        if (!order.includes(m.projectId)) order.push(m.projectId);
        types.set(m.projectId, (types.get(m.projectId) ?? new Set()).add(m.type.toLowerCase()));
        ranks.set(`${g.number}|${m.projectId}|${m.type.toLowerCase()}`, m.rank);
      }
      const projects = order.map(id => {
        const p = byId.get(id);
        if (!p) return null;
        return { ...p, items: (p.items || []).filter(i => types.get(id)!.has(String(i.type ?? '').toLowerCase())) };
      }).filter((p): p is PProject => !!p && p.items.length > 0);
      return { label: `Group ${g.number}`, group: g.number, projects };
    }).filter(s => s.projects.length > 0);
    return { sections: out, groupRanks: ranks };
  }, [grouped, filtered, pf.groups]);

  const visibleProjects = useMemo(() => [...new Map(sections.flatMap(s => s.projects).filter(p => p.id).map(p => [p.id!, p])).values()], [sections]);
  const projectCount = visibleProjects.length;
  const regionCount = sections.filter(s => s.projects.length > 0).length;

  // ── Active filter chips ──
  const chips: { id: string; label: string; clear: () => void }[] = [
    ...(Object.keys(sel) as FilterKey[]).flatMap(k => [...sel[k]].map(v => ({
      id: `${k}:${v}`,
      label: k === 'vendor' ? (vendors.find(x => x.id === v)?.code ?? 'Vendor') : k === 'status' ? (statusLabel.get(v) ?? v)
        : k === 'half' ? halfLabel(v) : k === 'container' ? (options.container.find(o => o.value === v)?.label ?? v) : v,
      clear: () => setSel(prev => { const n = new Set(prev[k]); n.delete(v); return { ...prev, [k]: n }; }),
    }))),
    ...[...activeQuick].map(t => ({ id: `q:${t}`, label: QUICK_LABEL[t], clear: () => toggleQuick(t) })),
  ];
  const clearAll = () => { setSel(noFilters()); setQuick(new Set()); };

  // ── Half toolbar ──
  useEffect(() => { setPicked(new Set()); setSelecting(false); setHalfError(''); }, [activeTab]);
  const allPicked = projectCount > 0 && visibleProjects.every(p => picked.has(p.id!));
  async function assignHalf(halfOfYear: 'FIRST_HALF' | 'SECOND_HALF' | null) {
    setHalfBusy(true); setHalfError('');
    const res = await fetch('/api/production/half', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: TAB_KIND[activeTab], ids: [...picked], halfOfYear, halfYear: halfOfYear ? year : null }),
    }).catch(() => null);
    setHalfBusy(false);
    if (!res?.ok) { setHalfError('Failed to assign half'); return; }
    setPicked(new Set());
    toast.success(halfOfYear ? `Assigned to ${year} ${halfOfYear === 'FIRST_HALF' ? 'First' : 'Second'} Half` : 'Half cleared');
    void load();
  }


  const BAR_BTN = 'inline-flex h-8 cursor-pointer items-center rounded-[6px] border-0 px-3 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="full-bleed-page flex w-full flex-col gap-[30px]" style={{ padding: '28px', boxSizing: 'border-box' }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Operations', href: '/production' }, { label: 'Production Board', href: '/production' }]} />
          <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">Production Board</h1>
          <p className="m-0 text-[13px] text-ui-body">
            {activeTab} · {projectCount} project{projectCount === 1 ? '' : 's'} across {regionCount} {grouped ? 'group' : 'region'}{regionCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {access.export && <button
            type="button" onClick={handleExport} disabled={exporting}
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent px-4 text-[13px] font-medium text-[var(--color-secondary-700)] disabled:opacity-70 dark:border-[#EEF2F6] dark:text-[#EEF2F6]"
          >
            {exporting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FolderOutput size={16} aria-hidden />}
            Export Excel
          </button>}
          {canAddProject && (
            <Link href="/projects/new" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-ui-btn-accent px-6 text-[13px] font-medium text-ui-btn-accent-fg no-underline hover:brightness-95">
              <Plus size={16} aria-hidden /> Add Project
            </Link>
          )}
        </div>
      </div>

      <div className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
        {tabs.map(tab => (
          <button
            key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={cn(
              '-mb-px border-0 border-b-2 border-solid bg-transparent p-0 text-[13px]',
              activeTab === tab
                ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'border-transparent font-medium text-ui-text-secondary',
            )}
          >
            {tab === 'Missing Extra' ? 'Missing & Extra' : tab}
          </button>
        ))}
      </div>

      {/* The filter bar stays on top while the page scrolls. */}
      <div className="sticky top-0 z-40 -my-3 flex flex-col gap-2 bg-ui-page-bg py-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 w-[220px] items-center gap-2 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-2.5">
            <Search size={16} aria-hidden className="shrink-0 text-ui-text-secondary" />
            <input
              aria-label="Search project number" placeholder="Search project..." value={search} onChange={e => setSearch(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ui-body outline-none placeholder:text-ui-text-secondary"
            />
          </label>
          <span className="inline-flex items-center gap-1 px-1 text-[13px] font-medium text-ui-text-secondary"><Filter size={14} aria-hidden /> Filters</span>
          {(Object.keys(FILTER_LABEL) as FilterKey[]).map(k => (
            <MultiFilter key={k} label={FILTER_LABEL[k]} options={options[k]} selected={sel[k]}
              onChange={next => setSel(prev => ({ ...prev, [k]: next }))} />
          ))}
          {projectsTab && (
            <Menu>
              <MenuTrigger render={<Button size="toolbar" />}>
                <Pencil size={14} aria-hidden /> Edit
              </MenuTrigger>
              <MenuContent align="start" className="min-w-[220px]">
                {access.todo && <MenuItem onClick={() => setTodoOpen(true)}>Today&apos;s PFs &amp; Follow Up</MenuItem>}
                <MenuItem onClick={() => setGroupsOpen(true)}>Groups</MenuItem>
              </MenuContent>
            </Menu>
          )}
          <QuickChips tokens={quick} onToggle={toggleQuick} flags={pf.flags} groups={pf.groups} projectsTab={projectsTab} showPf={access.viewPf} />
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-[4px] bg-ui-selected-bg py-1 pl-2 pr-1 text-[12px] font-medium text-[var(--color-secondary-700)] dark:text-ui-heading">
                {c.label}
                <button type="button" aria-label={`Remove ${c.label} filter`} onClick={c.clear}
                  className="inline-flex size-4 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent text-current hover:bg-ui-hover-bg"><X size={12} aria-hidden /></button>
              </span>
            ))}
            <span className="ml-auto flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={clearAll}>Clear all</Button>
              <span className="text-[12px] text-ui-text-secondary">{chips.length} active filter{chips.length === 1 ? '' : 's'}</span>
            </span>
          </div>
        )}

        {/* Half toolbar: only while selecting (right click a project → Select). */}
        {access.half && selecting && (
          <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-ui-divider bg-ui-surface px-3 py-2 text-[12px] text-ui-body">
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={allPicked} disabled={!projectCount}
                onChange={() => setPicked(allPicked ? new Set() : new Set(visibleProjects.map(p => p.id!)))} />
              Select All ({projectCount})
            </label>
            <span className="text-ui-text-secondary">{picked.size} selected</span>
            <label className="inline-flex items-center gap-1.5">Year
              <input type="number" aria-label="Year" value={year} min={2000} max={2100} onChange={e => setYear(Number(e.target.value) || new Date().getFullYear())}
                className="h-8 w-[76px] rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-2 text-[12px] text-ui-heading" />
            </label>
            <button type="button" disabled={!picked.size || halfBusy} onClick={() => void assignHalf('FIRST_HALF')} className={cn(BAR_BTN, 'bg-[#2563eb]')}>Assign to First Half</button>
            <button type="button" disabled={!picked.size || halfBusy} onClick={() => void assignHalf('SECOND_HALF')} className={cn(BAR_BTN, 'bg-[#16a34a]')}>Assign to Second Half</button>
            <button type="button" disabled={!picked.size || halfBusy} onClick={() => void assignHalf(null)} className={cn(BAR_BTN, 'bg-[#dc2626]')}>Clear Half</button>
            {halfError && <span className="text-error-normal">{halfError}</span>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setPicked(new Set()); setSelecting(false); setHalfError(''); }}>Done</Button>
          </div>
        )}
      </div>

      {projectsTab && <TodoModal open={todoOpen} onOpenChange={setTodoOpen} flags={pf.flags} projects={(data ?? EMPTY)['Projects']} onChanged={() => void pf.reload()} />}
      {projectsTab && <ManageGroupsModal open={groupsOpen} onOpenChange={setGroupsOpen} groups={pf.groups} canEdit={access.groups} onChanged={() => void pf.reload()} />}

      {data === null ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} />
        </div>
      ) : grouped && !pf.groups.length ? (
        <p className="m-0 rounded-[8px] border border-ui-divider p-8 text-center text-[13px] text-ui-text-secondary">No groups yet. Right-click a project number to create one.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <OperationalBoard sections={sections} access={access}
            groups={pf.groups} onGroupsChanged={() => void pf.reload()} onSaved={() => void load()}
            groupRanks={grouped ? groupRanks : undefined}
            selection={access.half ? {
              selected: picked, visible: selecting,
              toggle: id => { setSelecting(true); setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); },
            } : undefined} />
        </div>
      )}
    </div>
  );
}

