'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useMemo, useState } from 'react';
import {
  Search, AlertTriangle, ArrowDown, ArrowUp, Ban, ChevronDown, ChevronUp, ChevronsUp, FolderInput,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpportunityQuickView } from './OpportunityQuickView';
import { MarketingPipelineNav } from './MarketingPipelineNav';
import type { OpportunityStage, ProjectType, LeadEntityType } from '@/types/database';
import { Select } from '@/components/platform/shared/Select';

export interface DealRow {
  id: string;
  kind: 'opportunity' | 'potential';
  prospect_id: string;
  project_id: string | null;
  primary_contact_id: string | null;
  title: string;
  project_types: ProjectType[];
  stage: OpportunityStage | null;
  priority: 'low' | 'medium' | 'high';
  region: string | null;
  source_label: string | null;
  source_raw_label: string | null;
  marketing_owner_id: string | null;
  sales_owner_id: string | null;
  assigned_to: string | null;
  estimated_value: number | null;
  deposit: number | null;
  payment_raw: string | null;
  targeted: boolean;
  deadline: string | null;
  due_date: string | null;
  closed_at: string | null;
  date_done: string | null;
  industry_raw: string | null;
  brand: string | null;
  state: string | null;
  formatted_address: string | null;
  request_raw: string | null;
  to_do_raw: string | null;
  external_stage_label: string | null;
  tags: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  auto_managed: boolean;
  admin_corrected: boolean;
  lead_display_name: string;
  lead_entity_type: LeadEntityType;
  owner_name: string | null;
  sales_rep_name: string | null;
  contact_name: string | null;
  project_code: string | null;
  external_project_code: string | null;
}

interface Props {
  initialDeals: DealRow[];
  canEdit?: boolean;
  loadError?: boolean;
  prospectTotal: number | null;
  assignees: { id: string; full_name: string }[];
}

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME.format(d);
}

// Figma "Potentials" (node 245:26036) — same tabs, toolbar and table styling as Contacts.
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const PRIMARY_BTN = 'inline-flex h-10 items-center justify-center gap-3 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-6 text-[13px] font-semibold text-white no-underline hover:bg-[var(--color-secondary-700)]/90 disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950 [&_svg]:size-4';
const FILTER_STYLE: React.CSSProperties = {
  height: 40, fontSize: 12, borderRadius: 4, border: '1px solid var(--color-secondary-700)', background: 'var(--ui-input-bg)',
};
const TH_CLS = 'h-[46px] whitespace-nowrap px-2.5 text-left text-[12px] font-semibold leading-[1.4] text-ui-body';
const TD_CLS = 'px-2.5 py-2 text-[13px] text-ui-body';
const CHECKBOX_CLS = 'size-4 cursor-pointer accent-[var(--color-secondary-700)]';

const PRIORITY: Record<DealRow['priority'], { label: string; Icon: typeof ChevronsUp; color: string }> = {
  high: { label: 'High', Icon: ChevronsUp, color: 'var(--status-t10-fg)' },
  medium: { label: 'Medium', Icon: ChevronUp, color: 'var(--status-t7-fg)' },
  low: { label: 'Low', Icon: ChevronDown, color: 'var(--ui-text-secondary)' },
};
const REGION_FILTER_LABEL: Record<string, string> = {
  TLINES_NE: 'TLINES NE', TLINES_SE: 'TLINES SE', TLINES_NW: 'TLINES NW', CVW: 'TLINES WEST',
};

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 🔴 2026-09-17: this page is Marketing's Potentials-only work queue now — once a Potential
// is handed off, it's Sales's business (/leads, which already merges it in). Every row on
// this page is therefore always "Potential"; there's nothing to drop it down to here.
export function OpportunitiesPageClient({ initialDeals, canEdit, loadError, prospectTotal, assignees }: Props) {
  const [deals, setDeals] = useState(initialDeals);
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [nameSort, setNameSort] = useState<'asc' | 'desc' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<{ id: string; kind: 'opportunity' | 'potential' } | null>(null);
  const [savingAssignee, setSavingAssignee] = useState<string | null>(null);

  async function changeAssignee(d: DealRow, userId: string) {
    setSavingAssignee(d.id);
    const prev = deals;
    const nextOwnerName = assignees.find(a => a.id === userId)?.full_name ?? null;
    setDeals(ds => ds.map(x => (x.id === d.id ? { ...x, assigned_to: userId || null, owner_name: nextOwnerName } : x)));
    try {
      const path = d.kind === 'potential' ? `/api/marketing/potentials/${d.id}` : `/api/marketing/opportunities/${d.id}`;
      const field = d.kind === 'potential' ? 'assigned_to' : 'marketing_owner_id';
      const res = await fetch(path, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: userId || null }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setDeals(prev);
    } finally {
      setSavingAssignee(null);
    }
  }

  const sources = useMemo(
    () => [...new Set(deals.map(d => d.source_raw_label).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [deals],
  );

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = deals
      .filter(d => regionFilter === 'all' || !regionFilter || d.region === regionFilter)
      .filter(d => !sourceFilter || d.source_raw_label === sourceFilter)
      .filter(d => !q
        || (d.title || '').toLowerCase().includes(q)
        || (d.lead_display_name || '').toLowerCase().includes(q)
        || (d.brand || '').toLowerCase().includes(q));
    if (!nameSort) return rows;
    const dir = nameSort === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => dir * (a.title || a.lead_display_name || '').localeCompare(b.title || b.lead_display_name || ''));
  }, [deals, regionFilter, sourceFilter, query, nameSort]);

  const selectedRows = filteredDeals.filter(d => selected.has(d.id));
  const allSelected = filteredDeals.length > 0 && selectedRows.length === filteredDeals.length;

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Client-side CSV of the columns shown on screen — selected rows if any, else the filtered list.
  function exportFile() {
    const rows = selectedRows.length > 0 ? selectedRows : filteredDeals;
    const header = ['Name', 'Brand', 'Project no.', 'Priority', 'Assignee', 'Request', 'Location', 'Source', 'Date'];
    const lines = [header.join(',')].concat(rows.map(d => [
      d.title || d.lead_display_name, d.brand, d.external_project_code, PRIORITY[d.priority]?.label,
      d.owner_name ?? 'Not Assigned', d.request_raw, d.formatted_address || d.state, d.source_raw_label,
      formatDate(d.due_date || d.created_at),
    ].map(csvCell).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `potentials-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const getInitials = (name: string) =>
    (name || '?')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  if (loadError) {
    return (
      <div className="rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-12 text-center text-[13px] text-ui-text-secondary">
        <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: 'var(--status-t7-fg)' }} />
        <div>Potentials aren&apos;t ready yet.</div>
      </div>
    );
  }

  return (
    <div className="w-full pb-12">
      <div className="mb-[18px] flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Marketing', href: '/marketing' }, { label: 'Contacts', href: '/marketing/prospects' }, { label: 'Potentials', href: '/marketing/opportunities' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>Potentials</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {filteredDeals.length} record{filteredDeals.length === 1 ? '' : 's'} — click a row to open it, contacts still working toward real evidence for a Sales hand-off
        </p>
      </div>

      <div style={{ marginBottom: 18 }}>
        <MarketingPipelineNav
          current="potentials"
          prospectCount={prospectTotal} potentialCount={deals.length} opportunityCount={null}
        />
      </div>

      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] max-w-[380px] flex-[1_1_220px]">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
          <input
            className="form-input"
            style={{ height: 40, paddingLeft: 34, fontSize: 13, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)' }}
            placeholder="Search potentials…" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search potentials"
          />
        </div>
        <Select className="form-input" style={{ ...FILTER_STYLE, maxWidth: 170 }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} aria-label="Filter by source">
          <option value="">All Sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="form-input" style={{ ...FILTER_STYLE, maxWidth: 170 }} value={regionFilter} onChange={e => setRegionFilter(e.target.value)} aria-label="Filter by region">
          <option value="all">All regions</option>
          {Object.entries(REGION_FILTER_LABEL).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </Select>
        <span className="ml-auto flex items-center gap-2.5">
          {selectedRows.length > 0 && (
            <span className="text-[12px] text-ui-text-secondary">{selectedRows.length} selected</span>
          )}
          <button
            type="button" className={PRIMARY_BTN} disabled={filteredDeals.length === 0} onClick={exportFile}
            title={selectedRows.length > 0 ? 'Download the selected Potentials as CSV' : 'Download every Potential in this list as CSV'}
          >
            <FolderInput aria-hidden /> Export File
          </button>
        </span>
      </div>

      <div className="overflow-x-auto rounded-[6px] border border-ui-divider bg-ui-page-bg">
        {filteredDeals.length === 0 ? (
          <div className="p-12 text-center text-[13px] text-ui-text-secondary">No Potentials match your filters.</div>
        ) : (
          <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
            <thead>
              <tr className="border-b border-ui-divider bg-ui-surface">
                <th className={cn(TH_CLS, 'w-9 pl-[18px]')}>
                  <input
                    type="checkbox" className={CHECKBOX_CLS} checked={allSelected} aria-label="Select all"
                    onChange={() => setSelected(allSelected ? new Set() : new Set(filteredDeals.map(d => d.id)))}
                  />
                </th>
                <th className={TH_CLS}>
                  <button
                    type="button"
                    onClick={() => setNameSort(s => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))}
                    className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-[inherit] text-[inherit]"
                    aria-label="Sort by name"
                  >
                    Name
                    {nameSort === 'asc' ? <ArrowUp size={12} aria-hidden /> : nameSort === 'desc' ? <ArrowDown size={12} aria-hidden /> : null}
                  </button>
                </th>
                <th className={TH_CLS}>Brand</th>
                <th className={TH_CLS}>Project no.</th>
                <th className={TH_CLS}>Priority</th>
                <th className={TH_CLS}>Assignee</th>
                <th className={TH_CLS}>Request</th>
                <th className={TH_CLS}>Location</th>
                <th className={TH_CLS}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map(d => {
                const p = PRIORITY[d.priority];
                const isSelected = selected.has(d.id);
                return (
                  <tr
                    key={d.id}
                    onClick={() => setOpen({ id: d.id, kind: d.kind })}
                    className={cn('h-16 cursor-pointer border-t border-ui-divider hover:bg-ui-surface', isSelected && 'bg-ui-selected-bg')}
                  >
                    <td className={cn(TD_CLS, 'pl-[18px]')} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox" className={CHECKBOX_CLS} checked={isSelected} onChange={() => toggle(d.id)}
                        aria-label={`Select ${d.title || d.lead_display_name}`}
                      />
                    </td>
                    <td className={cn(TD_CLS, 'max-w-[260px]')}>
                      <span className={cn('block truncate text-[12px] font-medium', HEADING_TEXT)}>
                        {d.title || d.lead_display_name || 'Untitled'}
                      </span>
                    </td>
                    <td className={TD_CLS}>{d.brand || '—'}</td>
                    <td className={TD_CLS}>{d.external_project_code || '—'}</td>
                    <td className={TD_CLS}>
                      {p ? (
                        <span className="inline-flex items-center gap-1.5" style={{ color: p.color }}>
                          <p.Icon size={14} aria-hidden /> {p.label}
                        </span>
                      ) : 'Not set'}
                    </td>
                    <td className={TD_CLS} onClick={e => e.stopPropagation()}>
                      {canEdit ? (
                        <Select
                          value={d.assigned_to ?? ''}
                          disabled={savingAssignee === d.id}
                          onChange={e => changeAssignee(d, e.target.value)}
                          aria-label="Assignee"
                          className="max-w-[170px] cursor-pointer rounded-[4px] border border-transparent bg-transparent py-1 pl-1 pr-5 text-[13px] text-ui-body hover:border-ui-input-border"
                        >
                          <option value="">Not Assigned</option>
                          {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                        </Select>
                      ) : d.owner_name ? (
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold text-ui-body">
                            {getInitials(d.owner_name)}
                          </span>
                          {d.owner_name}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium"
                          style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}
                        >
                          <Ban size={14} aria-hidden /> Not Assigned
                        </span>
                      )}
                    </td>
                    <td className={cn(TD_CLS, 'max-w-[160px] truncate')}>{d.request_raw || '—'}</td>
                    <td className={cn(TD_CLS, 'max-w-[220px] truncate')}>{d.formatted_address || d.state || '—'}</td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>{formatDate(d.due_date || d.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick View Drawer */}
      {open && (
        <OpportunityQuickView
          opportunityId={open.id}
          kind={open.kind}
          assignees={assignees}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
