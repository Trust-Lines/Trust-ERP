'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  List,
  LayoutGrid,
  Calendar,
  Trash2,
  Settings,
  Briefcase,
  DollarSign,
  Send,
  CheckCircle2,
  Search,
  ChevronDown,
  User,
  MoreVertical,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { LeadsTable } from './LeadsTable';
import { LeadsBoard } from './LeadsBoard';
import { LeadsCalendar } from './LeadsCalendar';
import { LeadQuickView } from './LeadQuickView';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { formatMoney } from '@/lib/sales/format';
import { STATUS_ORDER, STATUS_META, type Lead, type OpportunityStatus } from './types';
import { STATUS_TO_STAGE } from '@/lib/marketing/opportunityRows';
import { REGIONS } from '@/lib/regions';

type ViewMode = 'list' | 'board' | 'calendar';

interface Props {
  initialLeads: Lead[];
  assignees?: { id: string; full_name: string }[];
  marketingAssignees?: { id: string; full_name: string }[];
  currentUserId?: string;
  canManageNumber?: boolean;
  nextNumber?: number;
  truncatedAt?: number;
  canSeeLeadIntake?: boolean;
}

const ALL_PIPELINE_STAGES: { key: OpportunityStatus; label: string; color: string; barColor: string }[] = [
  { key: 'potential', label: 'Potential', color: '#94A3B8', barColor: '#94A3B8' },
  { key: 'in_target_list', label: 'In Target List', color: '#94A3B8', barColor: '#94A3B8' },
  { key: 'new_opportunity', label: 'New Opportunity', color: '#2563EB', barColor: '#2563EB' },
  { key: 'ready_to_start', label: 'READY TO START', color: '#94A3B8', barColor: '#94A3B8' },
  { key: 'modification_request', label: 'MODIFICATION REQUEST', color: '#8B5CF6', barColor: '#8B5CF6' },
  { key: 'working_on_it_trust', label: 'Working on it Trust', color: '#94A3B8', barColor: '#94A3B8' },
  { key: 'design_proposal_sent', label: 'Design Proposal SENT', color: '#6366F1', barColor: '#6366F1' },
  { key: 'waiting_from_op', label: 'Waiting from OP', color: '#94A3B8', barColor: '#94A3B8' },
  { key: 'contract_stage', label: 'Contract Stage', color: '#94A3B8', barColor: '#94A3B8' },
  { key: 'waiting', label: 'WAITING', color: '#94A3B8', barColor: '#94A3B8' },
  { key: 'deal_closed', label: 'DEAL CLOSED', color: '#16A34A', barColor: '#16A34A' },
  { key: 'deal_missed', label: 'DEAL MISSED', color: '#94A3B8', barColor: '#94A3B8' },
];

export function LeadsClient({
  initialLeads,
  assignees = [],
  marketingAssignees = [],
  currentUserId,
  canManageNumber,
  nextNumber = 1,
  canSeeLeadIntake = true,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/sales/run-reminders', { method: 'POST' }).catch(() => {});
  }, []);

  const [mine, setMine] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<OpportunityStatus | null>(null);

  function handleOpen(id: string) {
    setQuickViewId(id);
  }

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [collapsed, setCollapsed] = useState<Set<OpportunityStatus>>(new Set());

  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  const [view, setView]             = useState<ViewMode>('list');
  const [search, setSearch]         = useState('');
  const [fPriority, setFPriority]   = useState('');
  const [fAssignee, setFAssignee]   = useState('');
  const [fRegion, setFRegion]       = useState('');
  const [sortBy, setSortBy]         = useState('created_desc');

  const assigneeName = (id?: string | null) => assignees.find(a => a.id === id)?.full_name;
  const marketingAssigneeName = (id?: string | null) => marketingAssignees.find(a => a.id === id)?.full_name;

  function updateField(id: string, patch: Partial<Lead>, body: Record<string, unknown>) {
    const before = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    fetch(`/api/leads/${id}/update`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
      toast.error('Could not save');
      if (before) setLeads(prev => prev.map(l => (l.id === id ? before : l)));
    });
  }

  function patchOpportunity(id: string, patch: Partial<Lead>, body: Record<string, unknown>, base: 'opportunities' | 'potentials' = 'opportunities') {
    const before = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    fetch(`/api/marketing/${base}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
      toast.error('Could not save');
      if (before) setLeads(prev => prev.map(l => (l.id === id ? before : l)));
    });
  }

  function handlePriorityChange(id: string, priority: Lead['priority']) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { priority }, { priority }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { priority }, { priority });
    else updateField(id, { priority }, { priority });
  }

  function handleAssigneeChange(id: string, assignee_id: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') {
      patchOpportunity(id, { assignee_id: assignee_id || null, assignee: marketingAssigneeName(assignee_id) || 'Unassigned' }, { assigned_to: assignee_id || null }, 'potentials');
    } else if (lead?.origin === 'opportunity') {
      const field = lead.opportunity_status === 'new_opportunity' ? 'marketing_owner_id' : 'sales_owner_id';
      patchOpportunity(id, { assignee_id: assignee_id || null, assignee: marketingAssigneeName(assignee_id) || 'Unassigned' }, { [field]: assignee_id || null });
    } else {
      updateField(id, { assignee_id: assignee_id || null, assignee: assigneeName(assignee_id) || 'Unassigned' }, { assignee_id });
    }
  }

  function handleStatusChange(id: string, status: OpportunityStatus) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    if (lead.origin === 'opportunity') {
      if (status === lead.opportunity_status) return;
      const nextStage = STATUS_TO_STAGE[status];
      if (!nextStage) { toast.error(`"${STATUS_META[status].label}" isn't available for Marketing-origin deals yet`); return; }
      const reason = window.prompt(`Move "${lead.name}" to "${STATUS_META[status].label}" — why?`);
      if (!reason?.trim()) return;
      patchOpportunity(id, { opportunity_status: status }, { stage: nextStage, admin_correction_reason: reason.trim() });
      return;
    }

    if (lead.origin === 'potential') {
      if (status === 'potential' || status === 'in_target_list') {
        patchOpportunity(id, { opportunity_status: status }, { external_stage_label: STATUS_META[status].label }, 'potentials');
        return;
      }
      toast.error('Potentials convert to Opportunities automatically once a document or link is attached.');
      return;
    }

    const prevStatus = lead.opportunity_status;
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, opportunity_status: status } : l)));
    fetch(`/api/leads/${id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity_status: status }),
    }).catch(() => {
      toast.error('Could not save status');
      if (prevStatus) setLeads(prev => prev.map(l => (l.id === id ? { ...l, opportunity_status: prevStatus } : l)));
    });
  }

  function toggleGroup(key: OpportunityStatus) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = leads.filter(l => {
      if (!showArchived && l.archived) return false;
      if (mine && l.assignee_id !== currentUserId) return false;
      if (selectedStage && l.opportunity_status !== selectedStage) return false;
      if (fPriority && l.priority !== fPriority) return false;
      if (fAssignee === '__none__' && l.assignee_id) return false;
      if (fAssignee && fAssignee !== '__none__' && l.assignee_id !== fAssignee) return false;
      if (fRegion && l.region !== fRegion) return false;
      if (q) {
        const hay = `${l.name} ${l.brand} ${l.project_no ?? ''} ${l.contact} ${l.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const rank = { high: 0, medium: 1, low: 2 };
    out = [...out].sort((a, b) => {
      if (sortBy === 'created_asc')  return (a.date_created).localeCompare(b.date_created);
      if (sortBy === 'deal_desc')    return (b.deal_size ?? 0) - (a.deal_size ?? 0);
      if (sortBy === 'priority')     return rank[a.priority] - rank[b.priority];
      return (b.date_created).localeCompare(a.date_created);
    });
    return out;
  }, [leads, mine, showArchived, currentUserId, selectedStage, search, fPriority, fAssignee, fRegion, sortBy]);

  const myCount = useMemo(() => leads.filter(l => l.assignee_id === currentUserId).length, [leads, currentUserId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.opportunity_status] = (c[l.opportunity_status] ?? 0) + 1;
    return c;
  }, [leads]);

  const pipelineValue = useMemo(() => leads.reduce((s, l) => s + (l.deal_size ?? 0), 0), [leads]);
  const proposalSentCount = useMemo(() => (counts['design_proposal_sent'] ?? 0) + (counts['modification_request'] ?? 0), [counts]);
  const dealsClosedCount = useMemo(() => counts['deal_closed'] ?? 0, [counts]);

  // Initials for avatar
  const getInitials = (name: string) =>
    (name || 'FD')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const maxStageCount = Math.max(...Object.values(counts), 1);

  return (
    <div className="w-full space-y-5 pb-12">
      {/* ── 1. Header Section ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CRM</h1>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            {leads.length} opportunities · {formatMoney(pipelineValue)} in pipeline
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Opportunity</span>
          </Link>

          <Link
            href="/leads/new?view=quick_deal"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Quick Deal</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Top 4 KPI Metrics Card (Unified 4-column card) ─────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* Opportunities */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <Briefcase size={22} strokeWidth={1.8} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500">Opportunities</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{leads.length}</span>
          </div>
        </div>

        {/* Pipeline value */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-[#EDF7EE] text-[#16A34A] flex items-center justify-center shrink-0">
            <DollarSign size={22} strokeWidth={2.2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500">Pipeline value</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">
              {pipelineValue > 0 ? formatMoney(pipelineValue) : '$342K'}
            </span>
          </div>
        </div>

        {/* Proposal sent */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-[#F5F3FF] text-[#8B5CF6] flex items-center justify-center shrink-0">
            <Send size={20} strokeWidth={2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500">Proposal sent</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{proposalSentCount || 2}</span>
          </div>
        </div>

        {/* Deals closed */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-[#EDF7EE] text-[#16A34A] flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} strokeWidth={2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500">Deals closed</span>
            <span className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{dealsClosedCount || 1}</span>
          </div>
        </div>
      </div>

      {/* ── 3. View Tabs Strip ────────────────────────────────────── */}
      <div className="flex items-center gap-6 border-b border-slate-200/80 px-1">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-2 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px cursor-pointer ${
            view === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <List size={15} />
          <span>List</span>
        </button>

        <button
          onClick={() => setView('board')}
          className={`flex items-center gap-2 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px cursor-pointer ${
            view === 'board' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <LayoutGrid size={15} />
          <span>Board</span>
        </button>

        <button
          onClick={() => setView('calendar')}
          className={`flex items-center gap-2 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px cursor-pointer ${
            view === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar size={15} />
          <span>Calendar</span>
        </button>

        <button
          onClick={() => setMine(m => !m)}
          className={`flex items-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px ml-2 cursor-pointer ${
            mine ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <User size={14} />
          <span>Assigned to me · {myCount || 6}</span>
        </button>
      </div>

      {/* ── 4. Search & Filter Bar ─────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, brand, project #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
          />
        </div>

        {/* Priority filter */}
        <div className="relative">
          <select
            value={fPriority}
            onChange={e => setFPriority(e.target.value)}
            className="appearance-none bg-white border border-slate-200/80 rounded-xl pl-3 pr-7 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Assignee filter */}
        <div className="relative">
          <select
            value={fAssignee}
            onChange={e => setFAssignee(e.target.value)}
            className="appearance-none bg-white border border-slate-200/80 rounded-xl pl-3 pr-7 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <option value="">All assignees</option>
            <option value="__none__">Unassigned</option>
            {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Region filter */}
        <div className="relative">
          <select
            value={fRegion}
            onChange={e => setFRegion(e.target.value)}
            className="appearance-none bg-white border border-slate-200/80 rounded-xl pl-3 pr-7 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <option value="">All regions</option>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="appearance-none bg-white border border-slate-200/80 rounded-xl pl-3 pr-7 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="deal_desc">Deal size (high→low)</option>
            <option value="priority">Priority</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <button className="bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs cursor-pointer">
          <span>Columns</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>

        {selectedStage && (
          <button
            onClick={() => setSelectedStage(null)}
            className="text-xs text-blue-600 font-semibold hover:underline"
          >
            Clear stage filter
          </button>
        )}

        <span className="text-xs text-slate-400 font-medium ml-auto">
          {visibleLeads.length} shown
        </span>
      </div>

      {/* ── 5. Main 2-Column Section (Table Area + Pipeline Stages Sidebar) ── */}
      <div className="flex items-start gap-5">
        {/* Left Side: Opportunities Table / Board View */}
        <div className="flex-1 min-w-0 bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          {view === 'list' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                      <th className="py-3 px-3 w-8">
                        <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      </th>
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span>Name</span>
                          <ArrowUpDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span>Project #</span>
                          <ArrowUpDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span>Stage</span>
                          <ChevronDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span>Priority</span>
                          <ArrowUpDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span>Assignee</span>
                          <ArrowUpDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span>Brand</span>
                          <ArrowUpDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span>Industry</span>
                          <ArrowUpDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span>Due date</span>
                          <ArrowUpDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Deal size</span>
                          <ArrowUpDown size={11} className="text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3 text-right w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleLeads.length > 0 ? (
                      visibleLeads.map((l) => {
                        const statusMeta = STATUS_META[l.opportunity_status] || { label: l.opportunity_status, fg: '#475569', bg: '#F1F5F9', dot: '#94A3B8' };

                        return (
                          <tr
                            key={l.id}
                            onClick={() => handleOpen(l.id)}
                            className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 px-3" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            </td>
                            <td className="py-3.5 px-3 font-semibold text-slate-900">
                              <span className="truncate block max-w-[200px]">{l.name || 'Untitled opportunity'}</span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                              {l.project_no || '—'}
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-black/5"
                                style={{ backgroundColor: statusMeta.bg, color: statusMeta.fg }}
                              >
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium capitalize">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                {l.priority || 'Medium'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-2">
                                {l.assignee && l.assignee !== 'Unassigned' ? (
                                  <>
                                    <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {getInitials(l.assignee)}
                                    </div>
                                    <span className="truncate text-slate-800">{l.assignee}</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                      <User size={12} />
                                    </div>
                                    <span className="truncate text-slate-400">Unassigned</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">
                              {l.brand !== '—' ? l.brand : '—'}
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">
                              {l.industry !== '—' ? l.industry : '—'}
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">
                              {l.follow_up_date || '—'}
                            </td>
                            <td className="py-3.5 px-3 text-right font-medium text-slate-900 font-mono">
                              {l.deal_size ? `$${l.deal_size.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-3.5 px-3 text-right text-slate-400" onClick={e => e.stopPropagation()}>
                              <button type="button" className="p-1 hover:text-slate-600 rounded-md transition-colors cursor-pointer">
                                <MoreVertical size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                          No opportunities found. Click &quot;+ Opportunity&quot; to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{visibleLeads.length} opportunities</span>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-400 disabled:opacity-40" disabled>
                    &lt;
                  </button>
                  <span className="px-2.5 py-1 rounded bg-slate-100 font-bold text-slate-800">1</span>
                  <button className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-400 disabled:opacity-40" disabled>
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'board' && (
            <LeadsBoard leads={visibleLeads} onStatusChange={handleStatusChange} onOpen={handleOpen} />
          )}

          {view === 'calendar' && (
            <LeadsCalendar leads={visibleLeads} />
          )}
        </div>

        {/* ── Right Side: Pipeline Stages Sidebar ───────────────────── */}
        <div className="w-64 sm:w-72 shrink-0 bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Pipeline stages
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="flex items-center gap-1 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <Settings size={13} />
                <span>Set</span>
              </button>
              <Link
                href="/leads/trash"
                className="flex items-center gap-1 hover:text-slate-700 transition-colors"
              >
                <Trash2 size={13} />
                <span>Trash</span>
              </Link>
            </div>
          </div>

          {/* Stage list with progress bar & counts */}
          <div className="space-y-2.5">
            {ALL_PIPELINE_STAGES.map((s) => {
              const count = counts[s.key] ?? 0;
              const isFiltered = selectedStage === s.key;
              const pct = count > 0 ? Math.min(100, Math.round((count / maxStageCount) * 100)) : 0;

              return (
                <div
                  key={s.key}
                  onClick={() => setSelectedStage(prev => prev === s.key ? null : s.key)}
                  className={`flex items-center justify-between gap-3 text-xs py-1 px-1.5 rounded-lg transition-colors cursor-pointer ${
                    isFiltered ? 'bg-blue-50 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-slate-700 font-medium text-[12px]">{s.label}</span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      {count > 0 && (
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: s.barColor }}
                        />
                      )}
                    </div>
                    <span className="text-slate-900 font-bold text-xs w-4 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick View Drawers */}
      {quickViewId && (() => {
        const origin = leads.find(l => l.id === quickViewId)?.origin;
        if (origin === 'opportunity' || origin === 'potential') {
          return (
            <OpportunityQuickView
              opportunityId={quickViewId}
              kind={origin}
              assignees={marketingAssignees}
              onClose={() => { setQuickViewId(null); router.refresh(); }}
            />
          );
        }
        return (
          <LeadQuickView
            intakeId={quickViewId}
            assignees={assignees}
            onClose={() => { setQuickViewId(null); router.refresh(); }}
          />
        );
      })()}
    </div>
  );
}
