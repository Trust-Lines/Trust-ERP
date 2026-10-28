'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight, FolderInput, Users, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProspectQuickView } from './ProspectQuickView';
import { Select } from '@/components/platform/shared/Select';
import { TagMultiSelect } from './TagMultiSelect';
import { REGIONS } from '@/lib/regions';
import { exportContactsWorkbook, type ContactExportRow } from '@/lib/excel/contactsExcelExport';
import { EmptyState } from '@/components/ui/empty-state';

// Deliberately NOT the query-builder Contacts page (2026-09-23's restriction — no browsing
// without a criterion, campaign/survey/project-status filters). This is the one exception to
// that, by design (2026-09-28): shows every Contact, newest-added first, same as the old
// unrestricted Contacts list — so manually-tagged rows that don't fit any query-builder
// criterion (e.g. "HRA 2026") are always reachable — with name/source/region filters on top to
// narrow it, and those same filters feed the Excel export. Sends browseAll=1 on every request;
// app/api/marketing/prospects/route.ts is the only place that flag is honored.

interface Row extends ContactExportRow {
  id: string;
  main_email: string | null;
  main_phone: string | null;
  source_raw_label: string | null;
  source_label: string | null;
  state: string | null;
  region: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

// Figma "Contact Manager" table (node 244:22594) — same toolbar/table styling as Contacts.
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const PRIMARY_BTN = 'inline-flex h-10 items-center justify-center gap-3 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-6 text-[13px] font-semibold text-white no-underline hover:bg-[var(--color-secondary-700)]/90 disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950 [&_svg]:size-4';
const FILTER_STYLE: React.CSSProperties = { height: 40, fontSize: 12, borderRadius: 4, border: '1px solid var(--color-secondary-700)', background: 'var(--ui-input-bg)' };
const TH_CLS = 'h-[46px] whitespace-nowrap px-2.5 text-left text-[12px] font-semibold leading-[1.4] text-ui-body';
const TD_CLS = 'px-2.5 py-2 text-[13px] text-ui-body';
const CHECKBOX_CLS = 'size-4 cursor-pointer accent-[var(--color-secondary-700)]';
const PAGE_BTN = 'inline-flex h-[34px] items-center justify-center gap-1 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-[14px] text-[13px] font-semibold text-[var(--color-secondary-700)] disabled:opacity-50 dark:text-ui-heading [&_svg]:size-3.5';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ContactManagerClient({ canEdit }: { canEdit: boolean }) {
  const [query, setQuery] = useState('');
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState('');
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [nameSort, setNameSort] = useState<'asc' | 'desc' | null>(null);
  // Selected Contact ids (kept across pages); when any are picked, Export only writes those.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    fetch('/api/marketing/prospects/source-options').then(r => r.json()).then(b => setSourceOptions(b.options ?? [])).catch(() => {});
  }, []);

  function buildParams(extra: Record<string, string>) {
    const params = new URLSearchParams({ browseAll: '1', ...extra });
    const name = query.trim();
    if (name) params.set('q', name);
    sourceFilters.forEach(s => params.append('source', s));
    if (regionFilter) params.set('region', regionFilter);
    return params;
  }

  async function load(nextPage: number) {
    setLoading(true);
    try {
      const params = buildParams({ page: String(nextPage), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/marketing/prospects?${params.toString()}`);
      const body = await res.json().catch(() => null);
      setRows(body?.prospects ?? []);
      setTotal(body?.total ?? 0);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; load(1); return; }
    // New filters = a different list, so an old selection would export the wrong people.
    setSelected(new Set());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, sourceFilters, regionFilter]);

  async function exportExcel() {
    setExporting(true);
    try {
      // export=1&detail=1: every field the card has, project name/number included — the API
      // itself fetches every matching row (capped at 5000), not just this page's 50.
      const params = buildParams({ export: '1', detail: '1' });
      const res = await fetch(`/api/marketing/prospects?${params.toString()}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) { toast.error(body?.error ?? 'Could not export.'); return; }
      const all = (body.contacts ?? []) as ContactExportRow[];
      const contacts = selected.size > 0 ? all.filter(c => c.id && selected.has(c.id)) : all;
      if (contacts.length === 0) { toast.error('Nothing to export.'); return; }
      const done = await exportContactsWorkbook(contacts, undefined, { onProgress: m => toast.loading(m, { id: 'excel-export' }) });
      toast.dismiss('excel-export');
      toast.success(`Exported ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}${done.photos ? ` with ${done.photos} photo${done.photos === 1 ? '' : 's'}` : ''}.`);
      if (done.photos < done.photosWanted) toast.message(`${done.photosWanted - done.photos} photo(s) could not be added to the Excel.`);
    } catch {
      toast.error('Could not export.');
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = !!(query.trim() || sourceFilters.length > 0 || regionFilter);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Name sort applies to the rows on this page; the server order (newest added first) is the default.
  const shownRows = nameSort
    ? [...rows].sort((a, b) => (nameSort === 'asc' ? 1 : -1) * a.display_name.localeCompare(b.display_name))
    : rows;
  const allSelected = shownRows.length > 0 && shownRows.every(r => selected.has(r.id));

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <p className="m-0 text-[11px] font-semibold text-ui-nav-active">Marketing / Contact Manager</p>
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>Contact Manager</h1>
          <p className="m-0 text-[13px] text-ui-body">
            {total.toLocaleString('en-US')} contact{total !== 1 ? 's' : ''} — newest added first.
          </p>
        </div>
      </div>

      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] max-w-[380px] flex-[1_1_220px]">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
          <input
            className="form-input"
            style={{ height: 40, paddingLeft: 34, fontSize: 13, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)' }}
            placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search Contacts by name"
          />
        </div>
        {/* Multi-select (2026-09-28, "birden fazla source seçebilsin") — same TagMultiSelect
            Contacts' filter bar uses. */}
        <div style={{ ...FILTER_STYLE, height: 'auto', minHeight: 40, display: 'flex', alignItems: 'center', minWidth: 160, maxWidth: 320, padding: '5px 11px' }}>
          <TagMultiSelect values={sourceFilters} options={sourceOptions} onChange={setSourceFilters} placeholder="All sources" />
        </div>
        <Select className="form-input" style={{ ...FILTER_STYLE, maxWidth: 170 }} value={regionFilter} onChange={e => setRegionFilter(e.target.value)} aria-label="Filter by region">
          <option value="">All regions</option>
          {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </Select>
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQuery(''); setSourceFilters([]); setRegionFilter(''); }}>
            Clear filters
          </button>
        )}
        {loading && <Loader2 size={15} className="animate-spin text-ui-text-secondary" aria-hidden />}
        <span className="ml-auto flex items-center gap-2.5">
          {selected.size > 0 && <span className="text-[12px] text-ui-text-secondary">{selected.size} selected</span>}
          <button
            type="button" className={PRIMARY_BTN} disabled={exporting || total === 0} onClick={exportExcel}
            title={selected.size > 0 ? 'Download the selected Contacts as a formatted Excel file' : 'Download every Contact matching these filters as a formatted Excel file'}
          >
            <FolderInput aria-hidden /> {exporting ? 'Exporting…' : selected.size > 0 ? `Export ${selected.size} to Excel` : 'Export to Excel'}
          </button>
        </span>
      </div>

      {total === 0 && !loading ? (
        <div className="rounded-[6px] border border-ui-divider bg-ui-page-bg">
          <EmptyState
            icon={<Users />}
            title={hasFilters ? 'No contact matches your filters' : 'No contacts yet'}
            description={hasFilters ? 'Try fewer filters or a different search.' : 'Contacts appear here as leads are captured or imported.'}
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[6px] border border-ui-divider bg-ui-page-bg">
            <table className="w-full border-collapse" style={{ minWidth: 900, opacity: loading ? 0.5 : 1 }}>
              <thead>
                <tr className="border-b border-ui-divider bg-ui-surface">
                  <th className={cn(TH_CLS, 'w-9 pl-[18px]')}>
                    <input
                      type="checkbox" className={CHECKBOX_CLS} checked={allSelected} aria-label="Select all on this page"
                      onChange={() => setSelected(prev => {
                        const next = new Set(prev);
                        for (const r of shownRows) { if (allSelected) next.delete(r.id); else next.add(r.id); }
                        return next;
                      })}
                    />
                  </th>
                  <th className={TH_CLS} aria-sort={nameSort ? (nameSort === 'asc' ? 'ascending' : 'descending') : undefined}>
                    <button
                      type="button"
                      onClick={() => setNameSort(s => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))}
                      className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-[inherit] text-[inherit]"
                      title="Sort this page by name"
                    >
                      Name
                      {nameSort === 'asc' ? <ArrowUp size={12} aria-hidden /> : nameSort === 'desc' ? <ArrowDown size={12} aria-hidden /> : null}
                    </button>
                  </th>
                  <th className={TH_CLS}>Email</th>
                  <th className={TH_CLS}>Phone</th>
                  <th className={TH_CLS}>Source</th>
                  <th className={TH_CLS}>State</th>
                  <th className={TH_CLS}>Added on</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map(r => {
                  const isSelected = selected.has(r.id);
                  return (
                    <tr
                      key={r.id} onClick={() => setQuickViewId(r.id)}
                      className={cn('h-16 cursor-pointer border-t border-ui-divider hover:bg-ui-surface', isSelected && 'bg-ui-selected-bg')}
                    >
                      <td className={cn(TD_CLS, 'pl-[18px]')} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className={CHECKBOX_CLS} checked={isSelected} onChange={() => toggle(r.id)} aria-label={`Select ${r.display_name}`} />
                      </td>
                      <td className={cn(TD_CLS, 'max-w-[260px] truncate')}>
                        <span className={cn('text-[13px] font-semibold', HEADING_TEXT)}>{r.display_name}</span>
                      </td>
                      <td className={cn(TD_CLS, 'max-w-[260px] truncate')}>{r.main_email || '—'}</td>
                      <td className={cn(TD_CLS, 'whitespace-nowrap')}>{r.main_phone || '—'}</td>
                      <td className={cn(TD_CLS, 'max-w-[200px] truncate')}>{r.source_raw_label || r.source_label || '—'}</td>
                      <td className={TD_CLS}>{r.state || '—'}</td>
                      <td className={cn(TD_CLS, 'whitespace-nowrap')}>{fmtDate(r.effective_created_at ?? r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-ui-text-secondary">
              <span>Showing {from}–{to} of {total.toLocaleString('en-US')} contacts</span>
              <div className="flex items-center gap-3">
                <button type="button" className={PAGE_BTN} disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
                  <ChevronLeft aria-hidden /> Previous
                </button>
                <span className="text-ui-body">Page {page} of {totalPages}</span>
                <button type="button" className={PAGE_BTN} disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>
                  Next <ChevronRight aria-hidden />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {quickViewId && <ProspectQuickView prospectId={quickViewId} onClose={() => setQuickViewId(null)} canEdit={canEdit} />}
    </>
  );
}
