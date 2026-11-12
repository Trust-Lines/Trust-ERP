'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2, Loader2, FolderKanban, Plus, Search, UserRoundPen, SquareDashed, Eye,
  ChevronDown, ChevronRight, ArrowDown, ArrowUp, Calendar, CalendarClock, MapPin, Pause,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { StageBadge, STAGES_FULL } from '@/components/platform/shared/StageBadge';
import { PermissionShield } from '@/components/platform/shared/PermissionShield';
import type { ProjectStage } from '@/types/database';
import type { ProjectRow, ProjectViewNote } from '@/app/(platform)/projects/page';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { PersonFace } from '@/components/ui/avatar-directory';
import { Select as FilterSelect } from '@/components/ui/select';
import { Checkbox as UiCheckbox } from '@/components/ui/checkbox';
import { TRUST_STAGE_LABEL, TRUST_STAGE_ORDER } from '@/lib/projects/listInfo';
import type { TrustStage } from '@/lib/trust/board';

interface Props {
  projects: ProjectRow[];
  userRole: string;
  today: string;
  viewNotes: Record<string, ProjectViewNote>;
  canCreate: boolean;
}

type SavedView = 'all' | 'waiting' | 'blocked';
type OptionalColumn = 'region' | 'type' | 'owner' | 'due' | 'value' | 'margin';

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };
const PAGE_SIZES = [14, 25, 50];

const COLUMN_LABEL: Record<OptionalColumn, string> = {
  region: 'Region', type: 'Types', owner: 'Owner', due: 'Due date', value: 'Value', margin: 'Margin',
};

// The dashboard's branch colours (its column headers) and stage colours (its sections).
const REGION_COLOR: Record<string, string> = { TLINES_NE: '#465B6D', TLINES_SE: '#3B472B', TLINES_NW: '#2E5BA3', CVW: '#7A655E' };
const REGION_SHORT: Record<string, string> = { TLINES_NE: 'NE', TLINES_SE: 'SE', TLINES_NW: 'NW', CVW: 'West' };
const STAGE_TONE: Record<TrustStage, { fg: string; bg: string }> = {
  finalization: { fg: 'var(--stage-finalization-fg)', bg: 'var(--stage-finalization-bg)' },
  technical: { fg: 'var(--stage-technical-fg)', bg: 'var(--stage-technical-bg)' },
  to_production: { fg: 'var(--stage-to-production-fg)', bg: 'var(--stage-to-production-bg)' },
  in_production: { fg: 'var(--stage-production-fg)', bg: 'var(--stage-production-bg)' },
  shipped: { fg: 'var(--stage-shipped-fg)', bg: 'var(--stage-shipped-bg)' },
};
const ink = (c: string) => `color-mix(in srgb, ${c} 70%, black)`;

// Unique stages for the "Add filter" stage picker (closed_deal / finalization share a label).
const STAGE_OPTIONS = STAGES_FULL.filter(s => s.stage !== 'closed_deal');

// Figma "Projects · Desktop" (node 217:6440) styling.
const CONTROL = 'relative inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:text-ui-heading [&>svg]:size-3.5 [&>svg]:shrink-0';
// Platform <Select> sitting inside a CONTROL chip: no box of its own, takes the chip's text colour.
const CHIP_SELECT = 'h-full w-auto gap-2 border-0 bg-transparent px-0 text-[13px] font-medium text-inherit hover:border-0 dark:rounded-none dark:border-0 dark:bg-transparent dark:px-0 dark:text-inherit [&_svg]:size-3.5';

// A click on the chip's icon or "Owner:" text opens its list too. Not a <label>: a label re-clicks the
// trigger after the press has already opened it, which closes the list again.
function openChipSelect(e: React.MouseEvent<HTMLDivElement>) {
  if ((e.target as Element).closest('[data-slot=select-trigger]')) return;
  e.currentTarget.querySelector<HTMLElement>('[data-slot=select-trigger]')?.click();
}
const TH_CLS = 'h-[46px] whitespace-nowrap px-2.5 text-left text-[12px] font-semibold leading-[1.4] text-ui-body';
const TD_CLS = 'px-2.5 text-[13px] text-ui-body';
const PAGE_BTN = 'inline-flex h-[34px] items-center justify-center rounded-[6px] border border-ui-input-border bg-ui-input-bg px-[14px] text-[13px] font-semibold text-[var(--color-secondary-700)] disabled:opacity-50 dark:text-ui-heading';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <UiCheckbox
      aria-label={label}
      checked={checked}
      onCheckedChange={onChange}
      onClick={e => e.stopPropagation()}
    />
  );
}

export function ProjectsTableClient({ projects, userRole, today, viewNotes, canCreate }: Props) {
  const router = useRouter();
  const [view, setView]               = useState<SavedView>('all');
  const [query, setQuery]             = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [trustStage, setTrustStage]   = useState<TrustStage | 'none' | ''>('');
  const [regionFilter, setRegionFilter] = useState('');
  const [sortDesc, setSortDesc]       = useState(true);
  const [pageSize, setPageSize]       = useState(PAGE_SIZES[0]);
  const [page, setPage]               = useState(1);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [deleting, setDeleting]       = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [hidden, setHidden]           = useState<Set<OptionalColumn>>(new Set(['margin']));
  const columnsRef = useRef<HTMLDivElement>(null);
  const hideSensitive = userRole === 'tlines_pm';
  const canDelete     = ['ops_manager', 'general_manager'].includes(userRole);

  useEffect(() => {
    if (!columnsOpen) return;
    function onDown(e: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [columnsOpen]);

  const owners = useMemo(
    () => [...new Set(projects.map(p => p.owner?.full_name).filter(Boolean) as string[])].sort(),
    [projects],
  );

  const viewCounts = useMemo(() => {
    const notes = Object.values(viewNotes);
    return {
      all: projects.length,
      waiting: notes.filter(n => n.view === 'waiting').length,
      blocked: notes.filter(n => n.view === 'blocked').length,
    };
  }, [projects, viewNotes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const stageMatch = (s: string) =>
      !stageFilter || s === stageFilter || (stageFilter === 'finalization' && s === 'closed_deal');
    return projects
      .filter(p => view === 'all' || viewNotes[p.id]?.view === view)
      .filter(p => !ownerFilter || p.owner?.full_name === ownerFilter)
      .filter(p => stageMatch(p.current_stage))
      .filter(p => !trustStage || (trustStage === 'none' ? !p.trust : p.trust?.stage === trustStage))
      .filter(p => !regionFilter || p.region === regionFilter)
      .filter(p => !q || [p.code, p.name, p.client?.name, p.address].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => (sortDesc ? -1 : 1) * (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true }));
  }, [projects, view, viewNotes, ownerFilter, stageFilter, trustStage, regionFilter, query, sortDesc]);

  // The stage cards on top: how many projects are at each Trust System stage.
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { none: 0 };
    for (const p of projects) { const k = p.trust?.stage ?? 'none'; c[k] = (c[k] ?? 0) + 1; }
    return c;
  }, [projects]);
  const regions = useMemo(() => [...new Set(projects.map(p => p.region).filter(Boolean) as string[])].sort(), [projects]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const from = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(currentPage * pageSize, filtered.length);

  // Any filter change starts again from page 1 and drops selections that may now be hidden.
  useEffect(() => { setPage(1); setSelected(new Set()); }, [view, query, ownerFilter, stageFilter, trustStage, regionFilter, pageSize]);

  const show = (c: OptionalColumn) => !hidden.has(c) && !(hideSensitive && c === 'margin');
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(p => selected.has(p.id));

  function toggleColumn(c: OptionalColumn) {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected(prev => {
      const next = new Set(prev);
      for (const p of pageRows) {
        if (allOnPageSelected) next.delete(p.id); else next.add(p.id);
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    const label = ids.length === 1
      ? `"${projects.find(p => p.id === ids[0])?.name ?? 'this project'}"`
      : `${ids.length} projects`;
    if (!window.confirm(`Move ${label} to trash? It will be permanently deleted after 30 days.`)) return;
    setDeleting(true);
    try {
      let failed = 0;
      for (const id of ids) {
        const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        if (!res.ok) failed++;
      }
      if (failed) toast.error(`Failed to delete ${failed} project${failed !== 1 ? 's' : ''}`);
      if (failed < ids.length) toast.success('Moved to trash');
      setSelected(new Set());
      router.refresh();
    } finally { setDeleting(false); }
  }

  if (!projects.length) {
    return (
      <div className="card">
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Projects keep the team, files and delivery stages for a job in one place."
          action={canCreate && (
            <Link href="/projects/new" className={buttonVariants()}><Plus /> Create first project</Link>
          )}
        />
      </div>
    );
  }

  const SAVED_VIEWS: { key: SavedView; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'waiting', label: 'Waiting on me' },
    { key: 'blocked', label: 'Blocked' },
  ];

  return (
    <>
      {/* Stage cards: where every project is in the Trust System — click one to show only those. */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {([...TRUST_STAGE_ORDER, 'none'] as (TrustStage | 'none')[]).map(k => {
          const tone = k === 'none' ? { fg: 'var(--ui-text-secondary)', bg: 'var(--ui-surface)' } : STAGE_TONE[k];
          const on = trustStage === k;
          return (
            <button
              key={k} type="button" aria-pressed={on} onClick={() => setTrustStage(on ? '' : k)}
              className={cn('flex cursor-pointer flex-col gap-1 rounded-[10px] border border-solid px-4 py-3 text-left transition-[box-shadow]', on ? 'shadow-[0_0_0_2px_currentColor]' : 'hover:shadow-[0_1px_6px_rgba(0,0,0,0.08)]')}
              style={{ background: tone.bg, borderColor: `color-mix(in srgb, ${tone.fg} 30%, transparent)`, color: ink(tone.fg) }}
            >
              <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide">
                <span aria-hidden className="size-2 rounded-full" style={{ background: tone.fg }} />
                {k === 'none' ? 'Not in Trust' : TRUST_STAGE_LABEL[k]}
              </span>
              <span className="text-[28px] font-semibold leading-none">{stageCounts[k] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div role="tablist" aria-label="Saved views" className="mb-[18px] flex gap-2 border-b border-ui-divider pb-3">
        {SAVED_VIEWS.map(v => {
          const active = view === v.key;
          return (
            <button
              key={v.key}
              role="tab"
              aria-selected={active}
              onClick={() => setView(v.key)}
              className={cn(
                'inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[6px] border-0 px-4 text-[13px] text-[var(--color-secondary-700)] dark:text-ui-heading',
                active ? 'bg-ui-selected-bg font-semibold' : 'bg-transparent font-medium hover:bg-ui-hover-bg',
              )}
            >
              {v.label}
              <span className="text-[12px] font-normal leading-[1.4]">{viewCounts[v.key]}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className={cn(CONTROL, 'w-[330px] max-w-full gap-2.5 font-normal')}>
            <Search aria-hidden className="text-ui-text-secondary" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ui-body outline-none placeholder:text-ui-text-secondary"
            />
          </label>

          <div className={cn(CONTROL, 'cursor-pointer')} onClick={openChipSelect}>
            <UserRoundPen aria-hidden />
            <span>Owner:</span>
            <FilterSelect
              aria-label="Filter by owner"
              value={ownerFilter}
              onValueChange={v => setOwnerFilter(v ?? '')}
              options={[{ value: '', label: 'Anyone' }, ...owners.map(o => ({ value: o, label: o }))]}
              className={CHIP_SELECT}
              popupClassName="min-w-[200px]"
            />
          </div>

          <div className={cn(CONTROL, 'cursor-pointer')} onClick={openChipSelect}>
            <MapPin aria-hidden />
            <span>Region:</span>
            <FilterSelect
              aria-label="Filter by region"
              value={regionFilter}
              onValueChange={v => setRegionFilter(v ?? '')}
              options={[{ value: '', label: 'All regions' }, ...regions.map(r => ({ value: r, label: REGION_SHORT[r] ?? r }))]}
              className={CHIP_SELECT}
              popupClassName="min-w-[160px]"
            />
          </div>

          <div className={cn(CONTROL, 'cursor-pointer')} onClick={openChipSelect}>
            <SquareDashed aria-hidden />
            <span>Stage:</span>
            <FilterSelect
              aria-label="Filter by stage"
              value={stageFilter}
              onValueChange={v => setStageFilter(v ?? '')}
              options={[{ value: '', label: 'Any stage' }, ...STAGE_OPTIONS.map(s => ({ value: s.stage, label: `${s.number}. ${s.label}` }))]}
              className={CHIP_SELECT}
              popupClassName="min-w-[220px]"
            />
          </div>

          {(ownerFilter || stageFilter || query || trustStage || regionFilter) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setOwnerFilter(''); setStageFilter(''); setQuery(''); setTrustStage(''); setRegionFilter(''); }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {canDelete && selected.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className={cn(CONTROL, 'cursor-pointer disabled:opacity-50')}
              style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)', borderColor: 'transparent' }}
            >
              {deleting ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
              Move {selected.size} to trash
            </button>
          )}
          <div ref={columnsRef} className="relative">
            <button
              aria-haspopup="menu"
              aria-expanded={columnsOpen}
              onClick={() => setColumnsOpen(o => !o)}
              className={cn(CONTROL, 'cursor-pointer')}
            >
              <Eye aria-hidden /> Columns <ChevronDown aria-hidden />
            </button>
            {columnsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+4px)] z-20 flex min-w-[180px] flex-col gap-0.5 rounded-[6px] border border-ui-input-border bg-ui-page-bg p-1.5 shadow-md"
              >
                {(Object.keys(COLUMN_LABEL) as OptionalColumn[])
                  .filter(c => !(hideSensitive && c === 'margin'))
                  .map(c => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-[13px] text-ui-body hover:bg-ui-hover-bg"
                    >
                      <UiCheckbox
                        checked={!hidden.has(c)}
                        onCheckedChange={() => toggleColumn(c)}
                      />
                      {COLUMN_LABEL[c]}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[6px] border border-ui-divider bg-ui-page-bg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr className="border-b border-ui-divider bg-ui-surface">
                <th className={cn(TH_CLS, 'w-9 pl-[18px]')}>
                  <Checkbox checked={allOnPageSelected} onChange={togglePage} label="Select all on this page" />
                </th>
                <th className={cn(TH_CLS, 'min-w-[320px]')}>
                  <button
                    onClick={() => setSortDesc(d => !d)}
                    className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-[inherit] text-[inherit]"
                    aria-label={`Sort by project no, ${sortDesc ? 'descending' : 'ascending'}`}
                  >
                    Project
                    {sortDesc ? <ArrowDown aria-hidden className="size-3" /> : <ArrowUp aria-hidden className="size-3" />}
                  </button>
                </th>
                {show('region') && <th className={cn(TH_CLS, 'w-[90px]')}>Region</th>}
                {show('type') && <th className={TH_CLS}>Types</th>}
                <th className={cn(TH_CLS, 'w-[180px]')}>Stage</th>
                {show('owner') && <th className={cn(TH_CLS, 'w-[180px]')}>Owner</th>}
                {show('due') && <th className={cn(TH_CLS, 'w-[138px]')}>Due date</th>}
                {show('value') && <th className={cn(TH_CLS, 'w-[130px] text-right')}>Value</th>}
                {show('margin') && <th className={cn(TH_CLS, 'w-[90px] text-right')}>Margin</th>}
                <th className={cn(TH_CLS, 'w-9 pr-[18px]')} aria-hidden>
                  <ChevronRight className="size-3.5 text-ui-text-secondary" />
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-[13px] text-ui-text-secondary">
                    No projects match this view or your filters.
                  </td>
                </tr>
              )}
              {pageRows.map(p => {
                const isOverdue =
                  !!p.est_delivery_date &&
                  p.est_delivery_date < today &&
                  p.current_stage !== 'delivered';
                const daysLate = isOverdue
                  ? Math.floor(
                      (new Date(today).getTime() - new Date(p.est_delivery_date!).getTime()) /
                        86400000,
                    )
                  : 0;
                // The next step / blocker only in its own view — on "All" every row would repeat it.
                const hint = view !== 'all' ? viewNotes[p.id]?.hint : null;
                const regionColor = (p.region && REGION_COLOR[p.region]) || 'var(--color-secondary-700)';
                const due = p.est_delivery_date ?? p.trust?.etd ?? null;
                const dueIsEtd = !p.est_delivery_date && !!p.trust?.etd;
                const types = p.trust?.types.length ? p.trust.types : (p.categories ?? []).map(c => ({ type: c, status: null as string | null }));

                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className={cn(
                      'h-16 cursor-pointer border-b border-ui-divider last:border-b-0 hover:bg-ui-surface',
                      selected.has(p.id) && 'bg-ui-surface',
                    )}
                  >
                    <td className={cn(TD_CLS, 'pl-[18px]')}>
                      <Checkbox checked={selected.has(p.id)} onChange={() => toggleRow(p.id)} label={`Select ${p.name}`} />
                    </td>
                    <td className={cn(TD_CLS, 'max-w-0 py-3')}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="inline-flex h-7 min-w-[84px] shrink-0 items-center justify-center rounded-[6px] px-2 text-[12px] font-semibold text-white"
                          style={{ background: regionColor }}
                        >
                          {p.code}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[14px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">
                              {p.client?.name ?? p.address}
                            </span>
                            {p.trust?.onHold && (
                              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-semibold" style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
                                <Pause aria-hidden className="size-3" /> On Hold
                              </span>
                            )}
                          </span>
                          <span className="truncate text-[12px] text-ui-text-secondary">{p.client ? p.address : null}</span>
                          {hint && <span className="truncate text-[11px] font-medium text-[var(--status-t7-fg)]">{hint}</span>}
                        </div>
                      </div>
                    </td>
                    {show('region') && (
                      <td className={TD_CLS}>
                        {p.region ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium">
                            <span aria-hidden className="size-2 rounded-full" style={{ background: regionColor }} />
                            {REGION_SHORT[p.region] ?? p.region}
                          </span>
                        ) : <span className="text-ui-text-secondary">—</span>}
                      </td>
                    )}
                    {show('type') && (
                      <td className={cn(TD_CLS, 'py-3')}>
                        {types.length ? (
                          <span className="flex flex-wrap gap-1">
                            {types.slice(0, 3).map(t => (
                              <span key={t.type} className="inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-[4px] bg-ui-surface px-2 text-[11px] text-ui-body">
                                <span className="font-semibold">{t.type}</span>
                                {t.status && <span className="text-ui-text-secondary">· {t.status}</span>}
                              </span>
                            ))}
                            {types.length > 3 && <span className="self-center text-[11px] text-ui-text-secondary">+{types.length - 3}</span>}
                          </span>
                        ) : <span className="text-ui-text-secondary">—</span>}
                      </td>
                    )}
                    <td className={TD_CLS}>
                      {p.trust ? (
                        <span
                          className="inline-flex h-[24px] items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2.5 text-[12px] font-semibold"
                          style={{ background: STAGE_TONE[p.trust.stage].bg, color: ink(STAGE_TONE[p.trust.stage].fg) }}
                        >
                          <span aria-hidden className="size-1.5 rounded-full" style={{ background: STAGE_TONE[p.trust.stage].fg }} />
                          {TRUST_STAGE_LABEL[p.trust.stage]}
                        </span>
                      ) : (
                        <StageBadge
                          stage={p.current_stage as ProjectStage}
                          className="h-[22px] gap-1 rounded-[4px] pl-2 pr-2.5 text-[12px] leading-4 [&_svg]:size-3.5"
                        />
                      )}
                    </td>
                    {show('owner') && (
                      <td className={TD_CLS}>
                        {p.owner ? (
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold leading-[1.4] text-ui-body">
                              <PersonFace name={p.owner.full_name} fallback={initials(p.owner.full_name)} />
                            </span>
                            <span className="flex flex-col leading-tight">
                              {p.owner.full_name}
                              {p.ownerFromBoard && <span className="text-[10px] text-ui-text-secondary">Assigned on the dashboard</span>}
                            </span>
                          </span>
                        ) : (
                          <span className="text-ui-text-secondary">—</span>
                        )}
                      </td>
                    )}
                    {show('due') && (
                      <td className={TD_CLS}>
                        {due ? (
                          <span
                            className={cn('flex flex-col gap-[3px] text-[12px]', isOverdue ? 'text-[var(--status-t7-fg)]' : 'text-ui-body')}
                          >
                            <span className="flex items-center gap-[5px] whitespace-nowrap">
                              {isOverdue
                                ? <CalendarClock aria-hidden className="size-3.5 shrink-0" />
                                : <Calendar aria-hidden className="size-3.5 shrink-0" />}
                              {formatDate(due)}
                            </span>
                            {dueIsEtd && <span className="text-[10px] text-ui-text-secondary">ETD · Trust System</span>}
                            {isOverdue && (
                              <span className="text-[10px]">
                                {daysLate} day{daysLate !== 1 ? 's' : ''} overdue
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-ui-text-secondary">—</span>
                        )}
                      </td>
                    )}
                    {show('value') && (
                      <td className={cn(TD_CLS, 'whitespace-nowrap text-right font-medium')}>
                        {hideSensitive ? (
                          <PermissionShield label="Restricted" />
                        ) : p.deal_value != null ? (
                          `${CURRENCY_SYMBOL[p.currency] ?? ''}${p.deal_value.toLocaleString('en-US')}${CURRENCY_SYMBOL[p.currency] ? '' : ` ${p.currency}`}`
                        ) : (
                          <span className="text-ui-text-secondary">—</span>
                        )}
                      </td>
                    )}
                    {show('margin') && (
                      <td className={cn(TD_CLS, 'text-right')}>
                        {p.margin_target_pct != null ? (
                          <span className="pill" style={{
                            background: p.margin_target_pct >= 20 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                            color: p.margin_target_pct >= 20 ? 'var(--status-success-fg)' : 'var(--status-warning-fg)',
                          }}>
                            {p.margin_target_pct}%
                          </span>
                        ) : <span className="text-ui-text-secondary">—</span>}
                      </td>
                    )}
                    <td className={cn(TD_CLS, 'pr-[18px]')}>
                      <ChevronRight aria-hidden className="size-3.5 text-ui-text-secondary" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-divider px-4 py-[15px]">
          <span className="text-[12px] leading-[1.4] text-ui-text-secondary">
            Showing {from}–{to} of {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-3 text-[12px] leading-[1.4] text-ui-body">
            <FilterSelect
              aria-label="Projects per page"
              value={String(pageSize)}
              onValueChange={v => { if (v) setPageSize(Number(v)); }}
              options={PAGE_SIZES.map(n => ({ value: String(n), label: `${n} per page` }))}
              className={cn(CHIP_SELECT, 'text-[12px] text-ui-body dark:text-ui-body [&_svg]:size-3')}
            />
            <button className={PAGE_BTN} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === currentPage ? 'page' : undefined}
                className={cn(
                  'grid size-8 cursor-pointer place-items-center rounded-[6px] border-0 text-[12px] text-ui-body',
                  n === currentPage ? 'bg-ui-selected-bg font-semibold' : 'bg-transparent hover:bg-ui-hover-bg',
                )}
              >
                {n}
              </button>
            ))}
            <button className={PAGE_BTN} disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
