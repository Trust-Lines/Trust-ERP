'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { OpportunityQuickView } from './OpportunityQuickView';
import type { OpportunityStage, ProjectType, LeadEntityType } from '@/types/database';

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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  } catch {
    return '—';
  }
}

const PRIORITY_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#94a3b8' };
const REGION_FILTER_LABEL: Record<string, string> = {
  TLINES_NE: 'TLINES NE', TLINES_SE: 'TLINES SE', TLINES_NW: 'TLINES NW', CVW: 'TLINES WEST',
};

// 🔴 2026-09-17: this page is Marketing's Potentials-only work queue now — once a Potential
// is handed off, it's Sales's business (/leads, which already merges it in). Every row on
// this page is therefore always "Potential"; there's nothing to drop it down to here.
export function OpportunitiesPageClient({ initialDeals, canEdit, loadError, prospectTotal, assignees }: Props) {
  const deals = initialDeals;
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [open, setOpen] = useState<{ id: string; kind: 'opportunity' | 'potential' } | null>(null);

  const regionFilteredDeals = useMemo(
    () => (regionFilter === 'all' || !regionFilter ? deals : deals.filter(d => d.region === regionFilter)),
    [deals, regionFilter],
  );

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return regionFilteredDeals;
    return regionFilteredDeals.filter(d =>
      (d.title || '').toLowerCase().includes(q)
      || (d.lead_display_name || '').toLowerCase().includes(q)
      || (d.brand || '').toLowerCase().includes(q));
  }, [regionFilteredDeals, query]);

  const getInitials = (name: string) =>
    (name || '?')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  if (loadError) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 shadow-2xs">
        <AlertTriangle size={28} className="mx-auto text-amber-500 mb-2" />
        <div>Potentials aren&apos;t ready yet.</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-12">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Potentials</h1>
        <p className="text-xs text-slate-500 font-normal mt-0.5">
          {filteredDeals.length} records — click a row to open it, contacts still working toward real evidence for a Sales hand-off
        </p>
      </div>

      {/* ── Navigation Tabs Strip & Filters Bar ───────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-6">
          <Link
            href="/marketing/prospects"
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors pb-1"
          >
            <span>Contacts</span>
            <span className="text-slate-400 font-normal">{prospectTotal ?? 0}</span>
          </Link>

          <button
            className="flex items-center gap-2 text-xs font-bold text-blue-600 border-b-2 border-blue-600 pb-1 cursor-pointer -mb-[13px]"
          >
            <span>Potentials</span>
            <span className="text-blue-600 font-bold">{filteredDeals.length}</span>
          </button>
        </div>

        {/* Right Filter Controls */}
        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="appearance-none bg-white border border-slate-200/80 rounded-xl pl-3 pr-7 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs font-medium"
            >
              <option value="all">All regions</option>
              {Object.entries(REGION_FILTER_LABEL).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search potentials"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* ── Dense flat table (single group — this page is Potential-only) ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {filteredDeals.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No Potentials match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="text-left font-semibold px-4 py-2">Name</th>
                  <th className="text-left font-semibold px-3 py-2">Brand</th>
                  <th className="text-left font-semibold px-3 py-2">Project #</th>
                  <th className="text-left font-semibold px-3 py-2">Priority</th>
                  <th className="text-left font-semibold px-3 py-2">Assignee</th>
                  <th className="text-left font-semibold px-3 py-2">Request</th>
                  <th className="text-left font-semibold px-3 py-2">Location</th>
                  <th className="text-left font-semibold px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => setOpen({ id: d.id, kind: d.kind })}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2 max-w-[240px]">
                      <span className="font-semibold text-slate-900 truncate block">
                        {d.title || d.lead_display_name || 'Untitled'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{d.brand || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{d.external_project_code || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLOR[d.priority] ?? '#cbd5e1' }} />
                        {d.priority ? d.priority[0].toUpperCase() + d.priority.slice(1) : 'Not set'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {d.owner_name ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <span className="h-5 w-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                            {getInitials(d.owner_name)}
                          </span>
                          {d.owner_name}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate">{d.request_raw || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{d.formatted_address || d.state || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {formatDate(d.due_date || d.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
