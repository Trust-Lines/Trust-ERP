'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2, Loader2, FolderKanban, Plus, Search, UserRoundPen, SquareDashed, Eye,
  ChevronDown, ChevronRight, ArrowDown, ArrowUp, Calendar, CalendarClock,
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

interface Props {
  projects: ProjectRow[];
  userRole: string;
  today: string;
  viewNotes: Record<string, ProjectViewNote>;
  canCreate: boolean;
}

type SavedView = 'all' | 'waiting' | 'blocked';
type OptionalColumn = 'customer' | 'type' | 'owner' | 'due' | 'value' | 'margin';

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };
const PAGE_SIZES = [14, 25, 50];

const COLUMN_LABEL: Record<OptionalColumn, string> = {
  customer: 'Customer', type: 'Type', owner: 'Owner', due: 'Due date', value: 'Value', margin: 'Margin',
};

// Unique stages for the "Add filter" stage picker (closed_deal / finalization share a label).
const STAGE_OPTIONS = STAGES_FULL.filter(s => s.stage !== 'closed_deal');

// Figma "Projects · Desktop" (node 217:6440) styling.
const CONTROL = 'relative inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:text-ui-heading [&>svg]:size-3.5 [&>svg]:shrink-0';
const NATIVE_SELECT_OVERLAY = 'absolute inset-0 cursor-pointer opacity-0';
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
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      className="m-0 size-4 cursor-pointer rounded-[3px] border border-ui-input-border bg-ui-input-bg accent-[var(--color-secondary-700)]"
    />
  );
}

export function ProjectsTableClient({ projects, userRole, today, viewNotes, canCreate }: Props) {
  const router = useRouter();
  const [view, setView]               = useState<SavedView>('all');
  const [query, setQuery]             = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
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
      .filter(p => !q || [p.code, p.name, p.client?.name].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => (sortDesc ? -1 : 1) * (a.code ?? '').localeCompare(b.code ?? ''));
  }, [projects, view, viewNotes, ownerFilter, stageFilter, query, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const from = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(currentPage * pageSize, filtered.length);

  // Any filter change starts again from page 1 and drops selections that may now be hidden.
  useEffect(() => { setPage(1); setSelected(new Set()); }, [view, query, ownerFilter, stageFilter, pageSize]);

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
              <span className="text-[12px] font-normal leading-[1.4] text-ui-text-secondary">{viewCounts[v.key]}</span>
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

          <div className={CONTROL}>
            <UserRoundPen aria-hidden />
            <span>Owner: {ownerFilter || 'Anyone'}</span>
            <ChevronDown aria-hidden />
            <select
              aria-label="Filter by owner"
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
              className={NATIVE_SELECT_OVERLAY}
            >
              <option value="">Anyone</option>
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className={CONTROL}>
            <SquareDashed aria-hidden />
            <span>
              {stageFilter ? `Stage: ${STAGE_OPTIONS.find(s => s.stage === stageFilter)?.label}` : 'Add filter'}
            </span>
            <select
              aria-label="Filter by stage"
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className={NATIVE_SELECT_OVERLAY}
            >
              <option value="">Any stage</option>
              {STAGE_OPTIONS.map(s => <option key={s.stage} value={s.stage}>{s.number}. {s.label}</option>)}
            </select>
          </div>

          {(ownerFilter || stageFilter || query) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setOwnerFilter(''); setStageFilter(''); setQuery(''); }}
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
                      <input
                        type="checkbox"
                        checked={!hidden.has(c)}
                        onChange={() => toggleColumn(c)}
                        className="m-0 size-4 accent-[var(--color-secondary-700)]"
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
                <th className={cn(TH_CLS, 'w-[116px]')}>
                  <button
                    onClick={() => setSortDesc(d => !d)}
                    className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-[inherit] text-[inherit]"
                    aria-label={`Sort by project no, ${sortDesc ? 'descending' : 'ascending'}`}
                  >
                    Project no
                    {sortDesc ? <ArrowDown aria-hidden className="size-3" /> : <ArrowUp aria-hidden className="size-3" />}
                  </button>
                </th>
                <th className={TH_CLS}>Name</th>
                {show('customer') && <th className={cn(TH_CLS, 'w-[190px]')}>Customer</th>}
                {show('type') && <th className={cn(TH_CLS, 'w-[112px]')}>Type</th>}
                <th className={cn(TH_CLS, 'w-[150px]')}>Stage</th>
                {show('owner') && <th className={cn(TH_CLS, 'w-[160px]')}>Owner</th>}
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
                const subline = viewNotes[p.id]?.hint ?? (p.categories ?? []).join(' · ');

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
                    <td className={cn(TD_CLS, 'whitespace-nowrap text-[12px] font-medium text-[var(--color-secondary-700)] dark:text-ui-heading')}>
                      {p.code}
                    </td>
                    <td className={cn(TD_CLS, 'max-w-0')}>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-[13px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">
                          {p.name}
                        </span>
                        {subline && (
                          <span className="truncate text-[11px] text-ui-text-secondary">{subline}</span>
                        )}
                      </div>
                    </td>
                    {show('customer') && (
                      <td className={cn(TD_CLS, 'max-w-[190px] truncate')}>
                        {p.client?.name ?? <span className="text-ui-text-disabled">—</span>}
                      </td>
                    )}
                    {show('type') && (
                      <td className={cn(TD_CLS, 'whitespace-nowrap')}>
                        {p.categories?.[0] ?? <span className="text-ui-text-disabled">—</span>}
                        {(p.categories ?? []).length > 1 && (
                          <span className="ml-1 text-[11px] text-ui-text-secondary">+{p.categories.length - 1}</span>
                        )}
                      </td>
                    )}
                    <td className={TD_CLS}>
                      <StageBadge
                        stage={p.current_stage as ProjectStage}
                        className="h-[22px] gap-1 rounded-[4px] pl-2 pr-2.5 text-[12px] leading-4 [&_svg]:size-3.5"
                      />
                    </td>
                    {show('owner') && (
                      <td className={TD_CLS}>
                        {p.owner ? (
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold leading-[1.4] text-ui-body">
                              {initials(p.owner.full_name)}
                            </span>
                            {p.owner.full_name}
                          </span>
                        ) : (
                          <span className="text-ui-text-disabled">—</span>
                        )}
                      </td>
                    )}
                    {show('due') && (
                      <td className={TD_CLS}>
                        {p.est_delivery_date ? (
                          <span
                            className={cn('flex flex-col gap-[3px] text-[12px]', isOverdue ? 'text-[var(--status-t7-fg)]' : 'text-ui-body')}
                          >
                            <span className="flex items-center gap-[5px] whitespace-nowrap">
                              {isOverdue
                                ? <CalendarClock aria-hidden className="size-3.5 shrink-0" />
                                : <Calendar aria-hidden className="size-3.5 shrink-0" />}
                              {formatDate(p.est_delivery_date)}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px]">
                                {daysLate} day{daysLate !== 1 ? 's' : ''} overdue
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-ui-text-disabled">—</span>
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
                          <span className="text-ui-text-disabled">—</span>
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
                        ) : <span className="text-ui-text-disabled">—</span>}
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
            <label className="relative inline-flex cursor-pointer items-center gap-3">
              {pageSize} per page
              <ChevronDown aria-hidden className="size-3" />
              <select
                aria-label="Projects per page"
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className={NATIVE_SELECT_OVERLAY}
              >
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n} per page</option>)}
              </select>
            </label>
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
