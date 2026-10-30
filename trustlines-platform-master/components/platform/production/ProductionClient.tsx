'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FolderOutput, Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { OperationalBoard } from './OperationalBoard';
import { ExtraItemsPanel } from './ExtraItemsPanel';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { Select as FilterSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  buildSectionsFromProjects, exportProjectsWorkbook, mapStatus, vendorText,
  type PItem, type PProject, type PSection,
} from '@/lib/excel/projectsExcelExport';

const TABS = ['Projects', 'Direct Orders', 'Missing Extra'] as const;
type Tab = typeof TABS[number];

const PROJECT_TOTAL_RATE = 41.23;

type BoardData = Record<Tab, PProject[]>;
const EMPTY: BoardData = { 'Projects': [], 'Direct Orders': [], 'Missing Extra': [] };

const FILTERS = [
  { key: 'vendor',    label: 'Vendor',    of: (i: PItem) => vendorText(i.vendor) },
  { key: 'type',      label: 'Type',      of: (i: PItem) => i.type ?? '' },
  { key: 'status',    label: 'Status',    of: (i: PItem) => mapStatus(i.status) },
  { key: 'container', label: 'Container', of: (i: PItem) => i.containerNo ?? '' },
] as const;
type FilterKey = typeof FILTERS[number]['key'];
const NO_FILTERS: Record<FilterKey, string> = { vendor: '', type: '', status: '', container: '' };

export function ProductionClient({ canEdit = false }: { canEdit?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('Projects');
  const [exporting, setExporting] = useState(false);
  const [data, setData]   = useState<BoardData | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);

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
    try {
      await exportProjectsWorkbook({
        projects:     sectionsByTab['Projects'],
        directOrders: sectionsByTab['Direct Orders'],
        missingExtra: sectionsByTab['Missing Extra'],
        projectTotalRate: PROJECT_TOTAL_RATE,
      });
      toast.success('Excel exported — 4 sheets (Projects, Missing & Extra, Direct Orders, Project Total)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally { setExporting(false); }
  }

  const tabSections = sectionsByTab[activeTab];

  const filterOptions = useMemo(() => {
    const items = tabSections.flatMap(s => s.projects.flatMap(p => p.items || []));
    return FILTERS.map(f => ({
      ...f,
      options: [
        { value: '', label: f.label },
        ...[...new Set(items.map(f.of).filter(Boolean))].sort().map(v => ({ value: v, label: v })),
      ],
    }));
  }, [tabSections]);

  // Filters only narrow what's on screen; Export Excel always writes the full board.
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const picked = FILTERS.filter(f => filters[f.key]);
    if (!q && !picked.length) return tabSections;
    const matches = (p: PProject, i: PItem) => (
      picked.every(f => f.of(i) === filters[f.key])
      && (!q || [p.projectNo, p.projectName, i.pfCode, vendorText(i.vendor)].some(v => String(v ?? '').toLowerCase().includes(q)))
    );
    return tabSections.map(s => ({
      ...s,
      projects: s.projects
        .map(p => ({ ...p, items: (p.items || []).filter(i => matches(p, i)) }))
        .filter(p => p.items.length > 0),
    }));
  }, [tabSections, search, filters]);

  const projectCount = sections.reduce((n, s) => n + s.projects.length, 0);
  const regionCount = sections.filter(s => s.projects.length > 0).length;

  return (
    <div className="full-bleed-page flex w-full flex-col gap-[30px]" style={{ padding: '28px', boxSizing: 'border-box' }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Operation' }, { label: 'Production Board', href: '/production' }]} />
          <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">Production Board</h1>
          <p className="m-0 text-[13px] text-ui-body">
            {activeTab} · {projectCount} project{projectCount === 1 ? '' : 's'} across {regionCount} region{regionCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button" onClick={handleExport} disabled={exporting}
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent px-4 text-[13px] font-medium text-[var(--color-secondary-700)] disabled:opacity-70 dark:border-[#EEF2F6] dark:text-[#EEF2F6]"
          >
            {exporting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FolderOutput size={16} aria-hidden />}
            Export Excel
          </button>
          {canEdit && (
            <Link href="/projects/new" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-ui-btn-accent px-6 text-[13px] font-medium text-ui-btn-accent-fg no-underline hover:brightness-95">
              <Plus size={16} aria-hidden /> New Project
            </Link>
          )}
        </div>
      </div>

      <div className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
        {TABS.map(tab => (
          <button
            key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={cn(
              '-mb-px border-0 border-b-2 border-solid bg-transparent p-0 text-[13px]',
              activeTab === tab
                ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'border-transparent font-medium text-ui-text-secondary',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 w-[285px] items-center gap-2 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-2.5">
          <Search size={16} aria-hidden className="shrink-0 text-ui-text-secondary" />
          <input
            aria-label="Search project" placeholder="Search project..." value={search} onChange={e => setSearch(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ui-body outline-none placeholder:text-ui-text-secondary"
          />
        </label>
        {filterOptions.map(f => (
          <FilterSelect
            key={f.key} aria-label={`Filter by ${f.label.toLowerCase()}`} className="h-9 w-auto text-[13px]"
            value={filters[f.key]} options={f.options}
            onValueChange={v => setFilters(prev => ({ ...prev, [f.key]: v ?? '' }))}
          />
        ))}
      </div>

      {data === null ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {activeTab === 'Direct Orders' && (
            <ExtraItemsPanel source="direct_order" label="Direct Orders" canEdit={canEdit} onChanged={load} />
          )}
          {activeTab === 'Missing Extra' && (
            <ExtraItemsPanel source="missing_extra" label="Missing & Extra" canEdit={canEdit} onChanged={load} />
          )}
          <OperationalBoard sections={sections} />
        </div>
      )}
    </div>
  );
}
