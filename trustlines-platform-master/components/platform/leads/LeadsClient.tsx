'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Rows3,
  Columns3,
  CalendarDays,
  Trash2,
  BriefcaseBusiness,
  CircleDollarSign,
  Send,
  CircleCheck,
  Search,
  ChevronDown,
  User,
  Archive,
  ArchiveRestore,
  ArrowDownUp,
  Columns2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { LeadsTable, LEAD_COLUMNS, DEFAULT_HIDDEN_COLUMNS } from './LeadsTable';
import { LeadsBoard } from './LeadsBoard';
import { LeadsCalendar } from './LeadsCalendar';
import { LeadQuickView } from './LeadQuickView';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { formatMoney } from '@/lib/sales/format';
import { STATUS_META, type Lead, type OpportunityStatus } from './types';
import { STATUS_TO_STAGE } from '@/lib/marketing/opportunityRows';
import { REGIONS } from '@/lib/regions';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { feedback } from '@/components/ui/feedback-toast';
import { StatCard } from '@/components/platform/shared/StatCard';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'board' | 'calendar';

// Figma "CRM Board" (node 280:25017).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
// 36px filter control: input border, white field, 13px medium label.
const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3.5';
const VIEW_TABS: { key: ViewMode; label: string; icon: LucideIcon }[] = [
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'board', label: 'Board', icon: Columns3 },
  { key: 'list', label: 'List', icon: Rows3 },
];
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  initialLeads: Lead[];
  assignees?: { id: string; full_name: string }[];
  marketingAssignees?: { id: string; full_name: string }[];
  currentUserId?: string;
  canManageNumber?: boolean;
  nextNumber?: number;
  truncatedAt?: number;
  canSeeLeadIntake?: boolean;
  /** Open this record's quick view on load (used by links from the Tasks page). */
  initialOpenId?: string;
  /** Pre-select a pipeline stage (links from the Sales dashboard). */
  initialStage?: OpportunityStatus;
}

export function LeadsClient({
  initialLeads,
  assignees = [],
  marketingAssignees = [],
  currentUserId,
  canManageNumber,
  nextNumber = 1,
  truncatedAt,
  canSeeLeadIntake = true,
  initialOpenId,
  initialStage,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/sales/run-reminders', { method: 'POST' }).catch(() => { });
  }, []);

  const [mine, setMine] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(initialOpenId ?? null);
  const [selectedStage, setSelectedStage] = useState<OpportunityStatus | null>(initialStage ?? null);

  function handleOpen(id: string) {
    setQuickViewId(id);
  }

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [collapsed, setCollapsed] = useState<Set<OpportunityStatus>>(new Set());

  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  const [view, setView] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [fRegion, setFRegion] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');

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

  function handleIndustryChange(id: string, industry: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { industry }, { industry_raw: industry || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { industry }, { industry_raw: industry || null });
    else updateField(id, { industry }, { industry: industry || null });
  }
  function handleToDoChange(id: string, to_do: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { to_do }, { to_do_raw: to_do || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { to_do }, { to_do_raw: to_do || null });
  }
  function handleRequestChange(id: string, request: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { request }, { request_raw: request || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { request }, { request_raw: request || null });
  }
  function handleProjectTypeRawChange(id: string, project_type: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { project_type }, { project_type_raw: project_type || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { project_type }, { project_type_raw: project_type || null });
  }
  function handleSourceRawChange(id: string, source: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { source }, { source_raw_label: source || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { source }, { source_raw_label: source || null });
  }
  function handlePaymentChange(id: string, payment_raw: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, {}, { payment_raw: payment_raw || null }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, {}, { payment_raw: payment_raw || null });
  }
  function handleDealSizeChange(id: string, deal_size: number | null) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { deal_size }, { estimated_value: deal_size }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { deal_size }, { estimated_value: deal_size });
    else updateField(id, { deal_size }, { deal_size });
  }
  function handleDepositChange(id: string, deposit: number | null) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { deposit }, { deposit }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { deposit }, { deposit });
  }
  function handleTargetedChange(id: string, targeted: boolean) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, { targeted }, { targeted }, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, { targeted }, { targeted });
  }

  const [menu, setMenu] = useState<{ x: number; y: number; lead: Lead } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  function openMenu(e: React.MouseEvent, lead: Lead) {
    e.preventDefault();
    if (lead.origin === 'opportunity' || lead.origin === 'potential') return;
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 210), y: e.clientY, lead });
  }

  async function archiveLead(lead: Lead, archived: boolean) {
    setMenu(null);
    setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, archived } : l)));
    const res = await fetch('/api/leads/' + lead.id + '/archive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not archive'); router.refresh(); }
    else feedback.info(archived ? 'Lead archived' : 'Lead unarchived', {
      description: lead.name,
      action: { label: 'Undo', onClick: () => void archiveLead(lead, !archived) },
    });
  }

  async function trashLead(lead: Lead) {
    setMenu(null);
    if (!window.confirm('Move "' + lead.name + '" to trash? It stays there for 30 days.')) return;
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    const res = await fetch('/api/leads/' + lead.id + '/trash', { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not move to trash'); router.refresh(); return; }
    feedback.info('Lead moved to Trash', {
      description: `${lead.name} can be restored for 30 days.`,
      action: { label: 'Undo move', onClick: () => void restoreLead(lead) },
    });
  }

  async function restoreLead(lead: Lead) {
    const res = await fetch('/api/leads/' + lead.id + '/restore', { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) {
      feedback.error('Could not restore', {
        description: `${lead.name} is still in Trash.`,
        action: { label: 'Try again', onClick: () => void restoreLead(lead) },
      });
      return;
    }
    setLeads(prev => (prev.some(l => l.id === lead.id) ? prev : [lead, ...prev]));
    feedback.success('Lead restored', { description: lead.name });
  }

  // Column visibility (Columns menu) — remembered per browser.
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set(DEFAULT_HIDDEN_COLUMNS));
  const [colsOpen, setColsOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('leadsTable.hiddenCols.v2');
      if (raw) setHiddenCols(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage unavailable — keep defaults */ }
  }, []);
  function toggleCol(name: string) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      try { localStorage.setItem('leadsTable.hiddenCols.v2', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
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
      // Compare real instants — mixed ISO offsets (Z vs +00:00) don't sort correctly as strings.
      const ta = Date.parse(a.date_created) || 0, tb = Date.parse(b.date_created) || 0;
      if (sortBy === 'created_asc') return ta - tb;
      if (sortBy === 'deal_desc') return (b.deal_size ?? 0) - (a.deal_size ?? 0);
      if (sortBy === 'priority') return rank[a.priority] - rank[b.priority];
      return tb - ta;
    });
    return out;
  }, [leads, mine, showArchived, currentUserId, selectedStage, search, fPriority, fAssignee, fRegion, sortBy]);

  const myCount = useMemo(() => leads.filter(l => l.assignee_id === currentUserId).length, [leads, currentUserId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.opportunity_status] = (c[l.opportunity_status] ?? 0) + 1;
    return c;
  }, [leads]);

  // "In pipeline" = deals still open — closed/missed money isn't pipeline.
  const pipelineValue = useMemo(() => leads.reduce((s, l) => s + (l.opportunity_status === 'deal_closed' || l.opportunity_status === 'deal_missed' ? 0 : (l.deal_size ?? 0)), 0), [leads]);
  const archivedCount = useMemo(() => leads.filter(l => l.archived).length, [leads]);
  const proposalSentCount = useMemo(() => (counts['design_proposal_sent'] ?? 0) + (counts['modification_request'] ?? 0), [counts]);
  const dealsClosedCount = useMemo(() => counts['deal_closed'] ?? 0, [counts]);

  // KPI chip: how many of each card's records were created in the last 7 days.
  const newCounts = useMemo(() => {
    const since = Date.now() - NEW_WINDOW_MS;
    const recent = leads.filter(l => (Date.parse(l.date_created) || 0) >= since);
    const open = (l: Lead) => l.opportunity_status !== 'deal_closed' && l.opportunity_status !== 'deal_missed';
    return {
      all: recent.length,
      pipeline: recent.filter(open).length,
      proposal: recent.filter(l => l.opportunity_status === 'design_proposal_sent' || l.opportunity_status === 'modification_request').length,
      closed: recent.filter(l => l.opportunity_status === 'deal_closed').length,
    };
  }, [leads]);
  const newChip = (n: number) => (n > 0 ? `+${n} New` : undefined);

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      {/* ── Page heading ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Sales', href: '/leads' }, { label: 'CRM Board', href: '/leads' }]} />
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>CRM Board</h1>
          <p className="text-[13px] text-ui-body">
            {leads.length} records · {formatMoney(pipelineValue)} open pipeline
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/leads/new"
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] pl-3 pr-5 text-[13px] font-medium leading-[1.35] text-[var(--color-secondary-700)] no-underline transition-colors hover:bg-ui-hover-bg dark:border-ui-heading dark:text-ui-heading [&_svg]:size-4"
          >
            <Plus aria-hidden />
            Opportunity
          </Link>
          <Link
            href="/leads/new?view=quick_deal"
            className="inline-flex h-9 items-center rounded-[6px] bg-ui-btn-accent px-8 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg no-underline transition-opacity hover:opacity-90"
          >
            Quick Deal
          </Link>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BriefcaseBusiness} label="All Records" value={leads.length} chip={newChip(newCounts.all)} />
        <StatCard icon={CircleDollarSign} label="Pipeline Value" value={formatMoney(pipelineValue)} chip={newChip(newCounts.pipeline)} />
        <StatCard icon={Send} label="Proposal Sent" value={proposalSentCount} chip={newChip(newCounts.proposal)} />
        <StatCard icon={CircleCheck} label="Deals Closed" value={dealsClosedCount} chip={newChip(newCounts.closed)} />
      </div>

      {truncatedAt && (
        <div className="rounded-xl border border-warning-normal bg-warning-light dark:bg-warning-dark/45 px-4 py-2.5 text-xs text-warning-dark dark:text-warning-light">
          Showing the newest <b>{truncatedAt}</b> records — there are more. Counts, totals and search only cover what&apos;s loaded.
        </div>
      )}

      {/* ── Toolbar: search + filters | sort, columns | views ─────── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-[285px] max-w-full">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input
              type="search"
              aria-label="Search records"
              placeholder="Search contacts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            />
          </div>

          <Select
            aria-label="Priority"
            className={FILTER_CLS}
            value={fPriority}
            onValueChange={v => setFPriority(v ?? '')}
            options={[
              { value: '', label: 'Priority' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />

          <Select
            aria-label="Assignee"
            className={FILTER_CLS}
            value={fAssignee}
            onValueChange={v => setFAssignee(v ?? '')}
            options={[
              { value: '', label: 'Assignee' },
              { value: '__none__', label: 'Unassigned' },
              ...assignees.map(a => ({ value: a.id, label: a.full_name })),
            ]}
          />

          <Select
            aria-label="Region"
            className={FILTER_CLS}
            value={fRegion}
            onValueChange={v => setFRegion(v ?? '')}
            options={[{ value: '', label: 'Regions' }, ...REGIONS.map(r => ({ value: r.code, label: r.label }))]}
          />

          {/* A filter toggle, not a view — so a pressed button. */}
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => setMine(m => !m)}
            className={cn(FILTER_CLS, 'pr-3 aria-pressed:border-[var(--color-secondary-700)] aria-pressed:bg-ui-selected-bg dark:aria-pressed:border-ui-heading')}
          >
            <User aria-hidden />
            Mine · {myCount}
          </button>

          {archivedCount > 0 && (
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setShowArchived(a => !a)}
              className={cn(FILTER_CLS, 'pr-3 aria-pressed:bg-ui-selected-bg')}
            >
              <Archive aria-hidden />
              {showArchived ? 'Hide' : 'Show'} archived · {archivedCount}
            </button>
          )}

          {selectedStage && (
            <button type="button" onClick={() => setSelectedStage(null)} className="text-[13px] font-medium text-ui-link hover:underline">
              Clear “{STATUS_META[selectedStage].label}” filter
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <ArrowDownUp aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--color-secondary-700)] dark:text-ui-heading" />
              <Select
                aria-label="Sort"
                className={cn(FILTER_CLS, 'gap-2 pl-[34px]')}
                value={sortBy}
                onValueChange={v => setSortBy(v ?? 'created_desc')}
                options={[
                  { value: 'created_desc', label: 'Newest' },
                  { value: 'created_asc', label: 'Oldest' },
                  { value: 'deal_desc', label: 'Deal size' },
                  { value: 'priority', label: 'Priority' },
                ]}
              />
            </div>

            {view === 'list' && (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={colsOpen}
                  className={cn(FILTER_CLS, 'gap-2 px-3')}
                  onClick={e => { e.stopPropagation(); setColsOpen(o => !o); }}
                >
                  <Columns2 aria-hidden />
                  Columns
                  <ChevronDown aria-hidden />
                </button>
                {colsOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setColsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-30 w-52 max-h-80 overflow-auto bg-ui-surface-elevated border border-ui-divider rounded-xl shadow-lg p-1.5">
                      {LEAD_COLUMNS.map((c, i) => (
                        <label key={c} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${i === 0 ? 'text-primary-400 dark:text-primary-300' : 'text-primary-700 dark:text-primary-100 hover:bg-primary-50 dark:hover:bg-primary-700 cursor-pointer'}`}>
                          <Checkbox disabled={i === 0} checked={i === 0 || !hiddenCols.has(c)} onCheckedChange={() => toggleCol(c)} />
                          {c}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <Link href="/leads/trash" aria-label="Trash" title="Trash" className={cn(FILTER_CLS, 'px-2.5 no-underline')}>
              <Trash2 aria-hidden />
            </Link>
          </div>

          <span aria-hidden className="h-9 w-px bg-ui-divider" />

          <div role="group" aria-label="View" className="flex items-center gap-2">
            {VIEW_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border px-8 text-[13px] font-semibold leading-[1.4] transition-colors [&_svg]:size-3.5',
                  view === key
                    ? 'border-[var(--color-secondary-700)] bg-transparent text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                    : 'border-ui-divider bg-ui-surface-elevated text-ui-body hover:bg-ui-hover-bg',
                )}
              >
                <Icon aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Records ───────────────────────────────────────────────── */}
      <div className={view === 'list' ? 'min-w-0' : 'min-w-0 bg-ui-surface-elevated border border-ui-divider rounded-2xl shadow-2xs overflow-hidden'}>
        {view === 'list' && (
          <LeadsTable
            leads={visibleLeads}
            assignees={assignees}
            marketingAssignees={marketingAssignees}
            collapsed={collapsed}
            hiddenColumns={hiddenCols}
            resetKey={[search, fPriority, fAssignee, fRegion, sortBy, mine, showArchived, selectedStage].join('|')}
            onToggleGroup={toggleGroup}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            onIndustryChange={handleIndustryChange}
            onToDoChange={handleToDoChange}
            onRequestChange={handleRequestChange}
            onProjectTypeRawChange={handleProjectTypeRawChange}
            onSourceRawChange={handleSourceRawChange}
            onTargetedChange={handleTargetedChange}
            onPaymentChange={handlePaymentChange}
            onDealSizeChange={handleDealSizeChange}
            onDepositChange={handleDepositChange}
            onAssigneeChange={handleAssigneeChange}
            onContextMenu={openMenu}
            onOpen={handleOpen}
          />
        )}

        {view === 'board' && (
          <LeadsBoard leads={visibleLeads} onStatusChange={handleStatusChange} onContextMenu={openMenu} onOpen={handleOpen} />
        )}

        {view === 'calendar' && (
          <LeadsCalendar leads={visibleLeads} />
        )}
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

      {menu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: menu.y, left: menu.x, zIndex: 10001, minWidth: 200, padding: 4,
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)', boxShadow: '0 6px 24px rgba(0,0,0,0.16)',
          }}
        >
          <div style={{ padding: '6px 10px 4px', fontSize: 11, color: 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{menu.lead.name}</div>
          <button onClick={() => archiveLead(menu.lead, !menu.lead.archived)} style={ctxItem}>
            {menu.lead.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {menu.lead.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => trashLead(menu.lead)} style={{ ...ctxItem, color: 'var(--status-danger)' }}>
            <Trash2 size={14} /> Move to trash
          </button>
        </div>
      )}
    </div>
  );
}

const ctxItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
  color: 'var(--fg-default)', textAlign: 'left', borderRadius: 6,
};
