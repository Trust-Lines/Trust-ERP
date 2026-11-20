'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2, Loader2, FolderKanban, Plus, Search, UserRoundPen, SquareDashed, Eye,
  ChevronDown, ArrowDown, ArrowUp, Calendar, CalendarClock, MapPin, Pause,
  DraftingCompass, Cog, ArrowUpFromDot, Loader, Ship, CircleSlash2, Award, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { STAGES_FULL } from '@/components/platform/shared/StageBadge';
import { PermissionShield } from '@/components/platform/shared/PermissionShield';
import type { ProjectRow, ProjectViewNote } from '@/app/(platform)/projects/page';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { Select as FilterSelect } from '@/components/ui/select';
import { Checkbox as UiCheckbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

// Region chips (Figma "Projects · Desktop" 1025:13854: NE #4A7599, W #624D46; SE / NW from the
// Gantt legend that shares the NE value).
const REGION_COLOR: Record<string, string> = { TLINES_NE: '#4A7599', TLINES_SE: '#607D39', TLINES_NW: '#2C64BE', CVW: '#624D46' };
const REGION_SHORT: Record<string, string> = { TLINES_NE: 'NE', TLINES_SE: 'SE', TLINES_NW: 'NW', CVW: 'W' };

type Tone = { fg: string; bg: string };
// Stage cards and row fills use the board's Process colours (fg = ink / chip, bg = fill).
const STAGE_TONE: Record<TrustStage, Tone> = {
  finalization: { fg: 'var(--board-finalization-fg)', bg: 'var(--board-finalization-bg)' },
  technical: { fg: 'var(--board-technical-fg)', bg: 'var(--board-technical-bg)' },
  to_production: { fg: 'var(--board-to-production-fg)', bg: 'var(--board-to-production-bg)' },
  in_production: { fg: 'var(--board-production-fg)', bg: 'var(--board-production-bg)' },
  shipped: { fg: 'var(--board-shipped-fg)', bg: 'var(--board-shipped-bg)' },
};
const NOT_IN_TRUST_TONE: Tone = { fg: 'var(--process-a0-fg)', bg: 'var(--process-a0-bg)' };
// Rows not (yet) in the Trust System: the design's green "Won" row.
const WON_TONE: Tone = { fg: 'var(--process-a0w-fg)', bg: 'var(--process-a0w-bg)' };
const STAGE_ICON: Record<TrustStage | 'none', LucideIcon> = {
  finalization: DraftingCompass, technical: Cog, to_production: ArrowUpFromDot,
  in_production: Loader, shipped: Ship, none: CircleSlash2,
};
// A project counts as "new" on its stage card for this many days after it was created.
const NEW_DAYS = 7;

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
const PAGE_BTN = 'inline-flex h-[34px] items-center justify-center rounded-[6px] border border-ui-input-border bg-ui-input-bg px-[14px] text-[13px] font-semibold text-[var(--color-secondary-700)] disabled:opacity-50 dark:text-ui-heading';

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
  const [hidden, setHidden]           = useState<Set<OptionalColumn>>(new Set(['margin']));
  const hideSensitive = userRole === 'tlines_pm';
  const canDelete     = ['ops_manager', 'general_manager'].includes(userRole);

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
  // "+N New" on each card: those created in the last NEW_DAYS days.
  const { stageCounts, newCounts } = useMemo(() => {
    const c: Record<string, number> = { none: 0 };
    const n: Record<string, number> = {};
    const since = new Date(`${today}T00:00:00`).getTime() - NEW_DAYS * 86400000;
    for (const p of projects) {
      const k = p.trust?.stage ?? 'none';
      c[k] = (c[k] ?? 0) + 1;
      if (p.created_at && new Date(p.created_at).getTime() >= since) n[k] = (n[k] ?? 0) + 1;
    }
    return { stageCounts: c, newCounts: n };
  }, [projects, today]);
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
      <div className="mb-[18px] grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {([...TRUST_STAGE_ORDER, 'none'] as (TrustStage | 'none')[]).map(k => {
          const tone = k === 'none' ? NOT_IN_TRUST_TONE : STAGE_TONE[k];
          const on = trustStage === k;
          const Icon = STAGE_ICON[k];
          const fresh = newCounts[k] ?? 0;
          return (
            <button
              key={k} type="button" aria-pressed={on} onClick={() => setTrustStage(on ? '' : k)}
              className={cn(
                'flex cursor-pointer flex-col gap-2 rounded-[8px] border-0 pb-4 pl-4 pr-4 pt-2.5 text-left transition-[box-shadow,filter] focus-visible:outline-2 focus-visible:outline-offset-2',
                on ? 'shadow-[0_0_0_2px_currentColor]' : 'hover:brightness-[0.97]',
              )}
              style={{ background: tone.bg, color: tone.fg }}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="text-[12px] font-medium uppercase leading-[1.5] tracking-[-0.264px]">
                  {k === 'none' ? 'Not in Trust' : TRUST_STAGE_LABEL[k]}
                </span>
                {fresh > 0 && (
                  <span
                    className="inline-flex h-[18px] shrink-0 items-center rounded-[4px] px-2 text-[10px] font-medium leading-[1.5] tracking-[0.4px]"
                    style={{ background: tone.fg, color: tone.bg }}
                  >
                    +{fresh} New
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[32px] font-semibold leading-[26px] tracking-[0.64px]">{stageCounts[k] ?? 0}</span>
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
              </span>
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
          {/* Checkbox list (stays open while ticking) — a Popover, not an action Menu. */}
          <Popover>
            <PopoverTrigger className={cn(CONTROL, 'cursor-pointer')}>
              <Eye aria-hidden /> Columns <ChevronDown aria-hidden />
            </PopoverTrigger>
            <PopoverContent aria-label="Columns" className="min-w-[180px] gap-0.5 p-1.5">
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
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="overflow-hidden rounded-[6px] border border-ui-divider bg-ui-page-bg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr className="border-b border-ui-divider bg-ui-surface">
                <th className={cn(TH_CLS, 'w-12 px-0 text-center')}>
                  <span className="inline-flex align-middle">
                    <Checkbox checked={allOnPageSelected} onChange={togglePage} label="Select all on this page" />
                  </span>
                </th>
                <th className={cn(TH_CLS, 'w-[120px] pl-1')}>
                  <button
                    onClick={() => setSortDesc(d => !d)}
                    className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-[inherit] text-[inherit]"
                    aria-label={`Sort by project no, ${sortDesc ? 'descending' : 'ascending'}`}
                  >
                    Project #
                    {sortDesc ? <ArrowDown aria-hidden className="size-3" /> : <ArrowUp aria-hidden className="size-3" />}
                  </button>
                </th>
                <th className={cn(TH_CLS, 'min-w-[220px]')}>Project Name</th>
                {show('region') && <th className={cn(TH_CLS, 'w-[124px]')}>Region</th>}
                {show('type') && <th className={cn(TH_CLS, 'w-[266px]')}>Types</th>}
                <th className={cn(TH_CLS, 'w-[157px]')}>Stage</th>
                {show('owner') && <th className={cn(TH_CLS, 'w-[200px]')}>Owner</th>}
                {show('due') && <th className={cn(TH_CLS, 'w-[180px]')}>Due date</th>}
                {show('value') && <th className={cn(TH_CLS, 'w-[113px]')}>Value</th>}
                {show('margin') && <th className={cn(TH_CLS, 'w-[90px] text-right')}>Margin</th>}
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
                // Row fill, ink and stage label follow the project's Trust stage; not in Trust = "Won" green.
                const tone = p.trust ? STAGE_TONE[p.trust.stage] : WON_TONE;
                const StageIcon = p.trust ? STAGE_ICON[p.trust.stage] : Award;
                const stageLabel = p.trust
                  ? TRUST_STAGE_LABEL[p.trust.stage]
                  : STAGES_FULL.find(s => s.stage === p.current_stage)?.label ?? p.current_stage;
                const isSelected = selected.has(p.id);
                const muted = { color: `color-mix(in srgb, ${tone.fg} 65%, transparent)` };

                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className={cn(
                      'h-[49px] cursor-pointer border-b border-ui-divider last:border-b-0 hover:brightness-[0.97]',
                      isSelected && 'shadow-[inset_3px_0_0_currentColor]',
                    )}
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    <td className="w-12 px-0 text-center">
                      <span className="inline-flex align-middle">
                        <Checkbox checked={isSelected} onChange={() => toggleRow(p.id)} label={`Select ${p.name}`} />
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[4px] px-4 text-[16px] font-medium leading-4"
                        style={{ background: tone.fg, color: tone.bg }}
                      >
                        {p.code}
                      </span>
                    </td>
                    <td className="max-w-0 py-2 pr-2">
                      <div className="flex min-w-0 flex-col leading-[1.4]">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">{p.client?.name ?? p.address}</span>
                          {p.trust?.onHold && (
                            <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-semibold" style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
                              <Pause aria-hidden className="size-3" /> On Hold
                            </span>
                          )}
                        </span>
                        {p.client && <span className="truncate text-[10px]">{p.address}</span>}
                        {hint && <span className="truncate text-[10px] font-medium text-[var(--status-t7-fg)]">{hint}</span>}
                      </div>
                    </td>
                    {show('region') && (
                      <td className="px-2">
                        {p.region ? (
                          <span
                            className="inline-flex h-[21px] min-w-[43px] items-center justify-center whitespace-nowrap rounded-[2px] px-2 text-[16px] font-medium leading-4 text-white"
                            style={{ background: regionColor }}
                          >
                            {REGION_SHORT[p.region] ?? p.region}
                          </span>
                        ) : <span style={muted}>—</span>}
                      </td>
                    )}
                    {show('type') && (
                      <td className="px-2 py-2">
                        {types.length ? (
                          <span className="flex flex-wrap gap-1">
                            {types.slice(0, 3).map(t => (
                              <span
                                key={t.type}
                                title={t.status ? `${t.type} · ${t.status}` : t.type}
                                className="inline-flex h-[21px] items-center whitespace-nowrap rounded-[2px] bg-ui-btn-primary px-2 text-[11px] font-medium leading-4 text-ui-btn-primary-fg"
                              >
                                {t.type}
                              </span>
                            ))}
                            {types.length > 3 && <span className="self-center text-[11px] font-medium">+{types.length - 3}</span>}
                          </span>
                        ) : <span style={muted}>—</span>}
                      </td>
                    )}
                    <td className="pr-2">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium leading-4">
                        <StageIcon aria-hidden className="size-3.5 shrink-0" />
                        {stageLabel}
                      </span>
                    </td>
                    {show('owner') && (
                      <td className="pr-2 text-[14px] font-medium">
                        {p.owner ? (
                          <span className="flex flex-col leading-tight">
                            <span className="truncate whitespace-nowrap">{p.owner.full_name}</span>
                            {p.ownerFromBoard && <span className="text-[10px] font-normal" style={muted}>Assigned on the dashboard</span>}
                          </span>
                        ) : (
                          <span style={muted}>—</span>
                        )}
                      </td>
                    )}
                    {show('due') && (
                      <td className="px-2.5 py-1">
                        {due ? (
                          isOverdue ? (
                            <span
                              className="inline-flex flex-col rounded-[4px] border border-solid p-1"
                              style={{ background: 'var(--process-a0l-bg)', borderColor: 'var(--process-a0l-fg)', color: 'var(--process-a0l-fg)' }}
                            >
                              <span className="flex items-center gap-[5px] whitespace-nowrap text-[14px] font-medium">
                                <CalendarClock aria-hidden className="size-3.5 shrink-0" />
                                {formatDate(due)}
                              </span>
                              <span className="text-[10px]">{daysLate} day{daysLate !== 1 ? 's' : ''} overdue</span>
                            </span>
                          ) : (
                            <span className="flex flex-col">
                              <span className="flex items-center gap-[5px] whitespace-nowrap text-[14px] font-medium">
                                <Calendar aria-hidden className="size-3.5 shrink-0" />
                                {formatDate(due)}
                              </span>
                              {dueIsEtd && <span className="text-[10px]" style={muted}>ETD · Trust System</span>}
                            </span>
                          )
                        ) : (
                          <span style={muted}>—</span>
                        )}
                      </td>
                    )}
                    {show('value') && (
                      <td className="whitespace-nowrap px-2.5 text-[14px] font-medium">
                        {hideSensitive ? (
                          <PermissionShield label="Restricted" />
                        ) : p.deal_value != null ? (
                          CURRENCY_SYMBOL[p.currency]
                            ? `${CURRENCY_SYMBOL[p.currency]} ${p.deal_value.toLocaleString('en-US')}`
                            : `${p.deal_value.toLocaleString('en-US')} ${p.currency}`
                        ) : (
                          <span style={muted}>—</span>
                        )}
                      </td>
                    )}
                    {show('margin') && (
                      <td className="px-2.5 text-right text-[13px]">
                        {p.margin_target_pct != null ? (
                          <span className="pill" style={{
                            background: p.margin_target_pct >= 20 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                            color: p.margin_target_pct >= 20 ? 'var(--status-success-fg)' : 'var(--status-warning-fg)',
                          }}>
                            {p.margin_target_pct}%
                          </span>
                        ) : <span style={muted}>—</span>}
                      </td>
                    )}
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
