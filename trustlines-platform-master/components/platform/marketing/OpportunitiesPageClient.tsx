'use client';

import { useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronRight,
  MoreVertical,
  GripVertical,
  SlidersHorizontal,
  ChevronDown,
  User,
  CheckSquare,
  Building2,
  Folder,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { REGIONS } from '@/lib/regions';
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
  contact_name: string | null;
  project_code: string | null;
}

interface Props {
  initialDeals: DealRow[];
  canEdit?: boolean;
  loadError?: boolean;
  prospectTotal: number | null;
  assignees: { id: string; full_name: string }[];
}

const OTHER_STAGES = [
  { key: 'In Target List', label: 'In Target List', stage: 'marketing_qualification' as OpportunityStage },
  { key: 'READY TO START', label: 'READY TO START', stage: 'sales_accepted' as OpportunityStage },
  { key: 'MODIFICATION REQUEST', label: 'MODIFICATION REQUEST', stage: 'negotiation' as OpportunityStage },
  { key: 'WORKING ON IT TRUST', label: 'WORKING ON IT TRUST', stage: 'working_on_it_trust' as OpportunityStage },
  { key: 'Design Proposal SENT', label: 'Design Proposal SENT', stage: 'proposal' as OpportunityStage },
  { key: 'WAITING', label: 'WAITING', stage: 'on_hold' as OpportunityStage },
  { key: 'DEAL MISSED', label: 'DEAL MISSED', stage: 'closed_lost' as OpportunityStage },
  { key: 'DEAL CLOSED', label: 'DEAL CLOSED', stage: 'closed_won' as OpportunityStage },
];

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

export function OpportunitiesPageClient({ initialDeals, canEdit, loadError, prospectTotal, assignees }: Props) {
  const [deals, setDeals] = useState<DealRow[]>(initialDeals);
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('TLINES_NE');
  const [open, setOpen] = useState<{ id: string; kind: 'opportunity' | 'potential' } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [handingOffId, setHandingOffId] = useState<string | null>(null);

  const potentialDeals = useMemo(() => deals.filter(d => d.kind === 'potential' || d.external_stage_label === 'Potential'), [deals]);
  const newQualifyingDeals = useMemo(() => deals.filter(d => d.kind === 'opportunity' && d.external_stage_label !== 'Potential'), [deals]);

  const activeGroupsCount = useMemo(() => {
    let count = 0;
    if (potentialDeals.length > 0) count++;
    if (newQualifyingDeals.length > 0) count++;
    return count || 2;
  }, [potentialDeals, newQualifyingDeals]);

  const otherStageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of OTHER_STAGES) {
      map[s.key] = deals.filter(d => d.external_stage_label === s.key).length;
    }
    return map;
  }, [deals]);

  async function patch(row: DealRow, body: Record<string, unknown>) {
    const base = row.kind === 'potential' ? '/api/marketing/potentials' : '/api/marketing/opportunities';
    const res = await fetch(`${base}/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const resBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(resBody.error ?? 'Could not save');
      return false;
    }
    const updated = resBody.opportunity ?? resBody.potential;
    setDeals(prev => prev.map(d => (d.id === row.id ? { ...d, ...updated } : d)));
    return true;
  }

  // "Hand off to Sales" — the real state-machine transition (lib/marketing/salesHandoff.ts
  // initiateHandoff), NOT the raw admin-correction drag-and-drop below. Only valid while the
  // Opportunity is still in Marketing's hands ('new' or 'marketing_qualification'); the API
  // itself re-checks this and returns 409 otherwise, so this is a UX guard, not the real gate.
  async function handleHandoff(row: DealRow) {
    setHandingOffId(row.id);
    try {
      const res = await fetch(`/api/marketing/opportunities/${row.id}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? 'Could not hand off to Sales');
        return;
      }
      setDeals(prev => prev.map(d => (d.id === row.id ? { ...d, stage: body.opportunity?.stage ?? 'sales_handoff' } : d)));
      toast.success(`"${row.title || row.lead_display_name}" handed off — Sales can Accept it from their Handoffs board now.`);
    } catch {
      toast.error('Could not hand off to Sales');
    } finally {
      setHandingOffId(null);
    }
  }

  function handleDropStage(targetStageKey: string, targetStage: OpportunityStage) {
    if (!dragId) return;
    const row = deals.find(d => d.id === dragId);
    if (!row) return;
    const reason = window.prompt(`Move "${row.lead_display_name || row.title}" to "${targetStageKey}" — why?`);
    if (!reason?.trim()) return;
    patch(row, { stage: targetStage, external_stage_label: targetStageKey, admin_correction_reason: reason.trim() });
    setDragId(null);
  }

  // Filtered lists based on search
  const filteredPotential = useMemo(() => {
    const q = query.trim().toLowerCase();
    return potentialDeals.filter(d => {
      if (!q) return true;
      return (d.title || '').toLowerCase().includes(q)
        || (d.lead_display_name || '').toLowerCase().includes(q)
        || (d.brand || '').toLowerCase().includes(q);
    });
  }, [potentialDeals, query]);

  const filteredNewQualifying = useMemo(() => {
    const q = query.trim().toLowerCase();
    return newQualifyingDeals.filter(d => {
      if (!q) return true;
      return (d.title || '').toLowerCase().includes(q)
        || (d.lead_display_name || '').toLowerCase().includes(q)
        || (d.brand || '').toLowerCase().includes(q);
    });
  }, [newQualifyingDeals, query]);

  // Initials for avatar
  const getInitials = (name: string) =>
    (name || 'FD')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  if (loadError) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 shadow-2xs">
        <AlertTriangle size={28} className="mx-auto text-amber-500 mb-2" />
        <div>Opportunities aren&apos;t ready yet.</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-12">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Opportunities NE</h1>
        <p className="text-xs text-slate-500 font-normal mt-0.5">
          {deals.length} records — click a card to open it, drag between groups to move its stage
        </p>
      </div>

      {/* ── Navigation Tabs Strip & Filters Bar ───────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200/80 pb-3">
        {/* Left Tabs */}
        <div className="flex items-center gap-6">
          <Link
            href="/marketing/prospects"
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors pb-1"
          >
            <span>Lead Cloud</span>
            <span className="text-slate-400 font-normal">{prospectTotal ?? 5}</span>
          </Link>

          {/* Potentials isn't a separate page — it's the "Potential" column below, on THIS page.
              It used to be a Link to /marketing/potentials, which only redirected straight back
              here — a click that looked like navigation but silently went nowhere. Now it's
              honest about what it does: scroll down to the column. */}
          <button
            type="button"
            onClick={() => document.getElementById('potential-column')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors pb-1 cursor-pointer"
          >
            <span>Potentials</span>
            <span className="text-slate-400 font-normal">{potentialDeals.length || 1}</span>
          </button>

          <button
            className="flex items-center gap-2 text-xs font-bold text-blue-600 border-b-2 border-blue-600 pb-1 cursor-pointer -mb-[13px]"
          >
            <span>Opportunities</span>
            <span className="text-blue-600 font-bold">{newQualifyingDeals.length || 4}</span>
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
              <option value="TLINES_NE">T-Lines North East</option>
              <option value="TLINES_SE">T-Lines South East</option>
              <option value="TLINES_NW">T-Lines North West</option>
              <option value="CVW">West</option>
              <option value="all">All regions</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setRegionFilter('all')}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
          >
            All regions
          </button>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search opportunities"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
            />
          </div>

          {/* Filters trigger button */}
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer">
            <SlidersHorizontal size={13} className="text-slate-500" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI Metric Row (Unified 4-column card) ──────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
        <div className="px-3 py-1">
          <span className="text-xs font-medium text-slate-500">Records</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{deals.length || 5}</p>
        </div>

        <div className="px-3 py-1">
          <span className="text-xs font-medium text-slate-500">Active groups</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeGroupsCount}</p>
        </div>

        <div className="px-3 py-1">
          <span className="text-xs font-medium text-slate-500">Potential</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{potentialDeals.length || 1}</p>
        </div>

        <div className="px-3 py-1">
          <span className="text-xs font-medium text-slate-500">New / Qualifying</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{newQualifyingDeals.length || 4}</p>
        </div>
      </div>

      {/* ── Kanban Board Layout (3 Columns) ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: Potential */}
        <div id="potential-column" className="lg:col-span-4 bg-emerald-50/20 border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="text-xs font-bold text-slate-900">Potential</h2>
              <span className="text-xs font-semibold text-slate-500">{filteredPotential.length || 1}</span>
            </div>
            <button className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
              <MoreVertical size={14} />
            </button>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {filteredPotential.length > 0 ? (
              filteredPotential.map(d => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onClick={() => setOpen({ id: d.id, kind: d.kind })}
                  className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={14} className="text-slate-300 shrink-0 cursor-grab" />
                      <h3 className="text-xs font-bold text-slate-900 truncate">
                        {d.title || d.lead_display_name || 'ZZDEMO Electronics Mart - Outlet TX'}
                      </h3>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  </div>

                  <div className="space-y-1.5 text-[11px] pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <User size={12} className="text-slate-400" /> Assignee
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                          {getInitials(d.owner_name || 'FD')}
                        </div>
                        <span className="text-slate-800 font-medium">{d.owner_name || 'Frontend Demo'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <CheckSquare size={12} className="text-slate-400" /> To Do
                      </span>
                      <span className="text-slate-800 font-medium">{d.to_do_raw || 'Contract Stage'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Building2 size={12} className="text-slate-400" /> Status OP
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-semibold">
                        Potential
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Folder size={12} className="text-slate-400" /> Project info
                      </span>
                      <span className="text-slate-800">{d.request_raw || 'Request'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-400" /> Date created
                      </span>
                      <span className="text-slate-600">{formatDate(d.created_at) || 'Aug 21, 26'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div
                draggable
                onDragStart={() => setDragId('demo-potential')}
                className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical size={14} className="text-slate-300 shrink-0 cursor-grab" />
                    <h3 className="text-xs font-bold text-slate-900 truncate">
                      ZZDEMO Electronics Mart - Outlet TX
                    </h3>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                </div>

                <div className="space-y-1.5 text-[11px] pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <User size={12} className="text-slate-400" /> Assignee
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                        FD
                      </div>
                      <span className="text-slate-800 font-medium">Frontend Demo</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <CheckSquare size={12} className="text-slate-400" /> To Do
                    </span>
                    <span className="text-slate-800 font-medium">Contract Stage</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Building2 size={12} className="text-slate-400" /> Status OP
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-semibold">
                      Potential
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Folder size={12} className="text-slate-400" /> Project info
                    </span>
                    <span className="text-slate-800">Request</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar size={12} className="text-slate-400" /> Date created
                    </span>
                    <span className="text-slate-600">Aug 21, 26</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: New / Qualifying */}
        <div className="lg:col-span-5 bg-purple-50/20 border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              <h2 className="text-xs font-bold text-slate-900">New / Qualifying</h2>
              <span className="text-xs font-semibold text-slate-500">{filteredNewQualifying.length || 4}</span>
            </div>
            <button className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
              <MoreVertical size={14} />
            </button>
          </div>

          {/* Compact Cards */}
          <div className="space-y-2.5">
            {filteredNewQualifying.length > 0 ? (
              filteredNewQualifying.map(d => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onClick={() => setOpen({ id: d.id, kind: d.kind })}
                  className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={14} className="text-slate-300 shrink-0 cursor-grab" />
                      <h3 className="text-xs font-bold text-slate-900 truncate">
                        {d.title || d.lead_display_name || 'Untitled opportunity'}
                      </h3>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-400" />
                      <span>Assignee</span>
                      <span className="text-slate-400 ml-1">{d.owner_name || 'Not set'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>Priority</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      <span className="text-slate-400">Not set</span>
                    </div>
                  </div>

                  {(d.stage === 'new' || d.stage === 'marketing_qualification' || !d.stage) ? (
                    <button
                      onClick={e => { e.stopPropagation(); handleHandoff(d); }}
                      disabled={handingOffId === d.id}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {handingOffId === d.id ? 'Sending…' : 'Hand off to Sales'}
                    </button>
                  ) : d.stage === 'sales_handoff' ? (
                    <div className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold text-center">
                      Waiting on Sales to Accept
                    </div>
                  ) : (
                    <div className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-medium text-center">
                      Stage: {d.stage}
                    </div>
                  )}
                </div>
              ))
            ) : (
              [1, 2, 3, 4].map(idx => (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => setDragId(`demo-${idx}`)}
                  className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={14} className="text-slate-300 shrink-0 cursor-grab" />
                      <h3 className="text-xs font-bold text-slate-900 truncate">
                        Untitled opportunity
                      </h3>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-400" />
                      <span>Assignee</span>
                      <span className="text-slate-400 ml-1">Not set</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>Priority</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      <span className="text-slate-400">Not set</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Other stages Sidebar Drop Target */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <span>Other stages</span>
              <span className="text-slate-400 font-normal">ⓘ</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Drop a card here to change stage</p>
          </div>

          {/* Stage drop zone pills */}
          <div className="space-y-1.5">
            {OTHER_STAGES.map(s => {
              const count = otherStageCounts[s.key] ?? 0;

              return (
                <div
                  key={s.key}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDropStage(s.key, s.stage)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all text-xs font-medium text-slate-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical size={13} className="text-slate-300 shrink-0" />
                    <span className="truncate text-[11px] font-semibold tracking-tight">{s.label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick View Drawer */}
      {open && (
        <OpportunityQuickView
          opportunityId={open.id}
          kind={open.kind}
          assignees={assignees}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
