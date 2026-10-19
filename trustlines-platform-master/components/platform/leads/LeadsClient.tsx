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
  Archive,
  ArchiveRestore,
  Columns3,
} from 'lucide-react';
import { toast } from 'sonner';
import { LeadsTable, LEAD_COLUMNS, DEFAULT_HIDDEN_COLUMNS } from './LeadsTable';
import { LeadsBoard } from './LeadsBoard';
import { LeadsCalendar } from './LeadsCalendar';
import { LeadQuickView } from './LeadQuickView';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';
import { formatMoney } from '@/lib/sales/format';
import { STATUS_META, type Lead, type OpportunityStatus } from './types';
import { opportunityTagTone } from '@/lib/status/tags';
import { STATUS_TO_STAGE } from '@/lib/marketing/opportunityRows';
import { REGIONS } from '@/lib/regions';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { feedback } from '@/components/ui/feedback-toast';

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
  /** Open this record's quick view on load (used by links from the Tasks page). */
  initialOpenId?: string;
  /** Pre-select a pipeline stage (links from the Sales dashboard). */
  initialStage?: OpportunityStatus;
}

const ALL_PIPELINE_STAGES: { key: OpportunityStatus; label: string; color: string; barColor: string }[] = [
  { key: 'potential', label: 'Potential', color: 'var(--color-primary-300)', barColor: 'var(--color-primary-300)' },
  { key: 'in_target_list', label: 'In Target List', color: 'var(--color-primary-300)', barColor: 'var(--color-primary-300)' },
  { key: 'new_opportunity', label: 'New Opportunity', color: 'var(--color-info-normal)', barColor: 'var(--color-info-normal)' },
  { key: 'ready_to_start', label: 'READY TO START', color: 'var(--color-primary-300)', barColor: 'var(--color-primary-300)' },
  { key: 'modification_request', label: 'MODIFICATION REQUEST', color: 'var(--color-warning-normal)', barColor: 'var(--color-warning-normal)' },
  { key: 'working_on_it_trust', label: 'Working on it Trust', color: 'var(--color-primary-300)', barColor: 'var(--color-primary-300)' },
  { key: 'design_proposal_sent', label: 'Design Proposal SENT', color: 'var(--color-accent-600)', barColor: 'var(--color-accent-600)' },
  { key: 'waiting_from_op', label: 'Waiting from OP', color: 'var(--color-primary-300)', barColor: 'var(--color-primary-300)' },
  { key: 'contract_stage', label: 'Contract Stage', color: 'var(--color-primary-300)', barColor: 'var(--color-primary-300)' },
  { key: 'waiting', label: 'WAITING', color: 'var(--color-primary-300)', barColor: 'var(--color-primary-300)' },
  { key: 'deal_closed', label: 'DEAL CLOSED', color: 'var(--color-success-normal)', barColor: 'var(--color-success-normal)' },
  { key: 'deal_missed', label: 'DEAL MISSED', color: 'var(--color-primary-300)', barColor: 'var(--color-primary-300)' },
];

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
      const raw = localStorage.getItem('leadsTable.hiddenCols.v1');
      if (raw) setHiddenCols(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage unavailable — keep defaults */ }
  }, []);
  function toggleCol(name: string) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      try { localStorage.setItem('leadsTable.hiddenCols.v1', JSON.stringify([...next])); } catch { /* ignore */ }
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

  const maxStageCount = Math.max(...Object.values(counts), 1);

  return (
    <div className="w-full space-y-5 pb-12">
      {/* ── 1. Header Section ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-50 tracking-tight">CRM</h1>
          <p className="text-xs text-primary-500 dark:text-primary-200 font-normal mt-0.5">
            {leads.length} records · {formatMoney(pipelineValue)} open pipeline
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/leads/new" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
            <Plus strokeWidth={2.5} />
            <span>Opportunity</span>
          </Link>

          <Link href="/leads/new?view=quick_deal" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            <span>Quick Deal</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Top 4 KPI Metrics Card (Unified 4-column card) ─────── */}
      <div className="bg-ui-surface-elevated border border-ui-divider rounded-2xl p-4 sm:p-5 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-ui-divider">
        {/* Opportunities */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-info-light dark:bg-info-dark/45 text-info-normal flex items-center justify-center shrink-0">
            <Briefcase size={22} strokeWidth={1.8} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-primary-500 dark:text-primary-200">All records</span>
            <span className="text-2xl font-bold text-primary-800 dark:text-primary-50 leading-tight mt-0.5">{leads.length}</span>
          </div>
        </div>

        {/* Pipeline value */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-success-light dark:bg-success-dark/45 text-success-dark dark:text-success-light flex items-center justify-center shrink-0">
            <DollarSign size={22} strokeWidth={2.2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-primary-500 dark:text-primary-200">Pipeline value</span>
            <span className="text-2xl font-bold text-primary-800 dark:text-primary-50 leading-tight mt-0.5">
              {formatMoney(pipelineValue)}
            </span>
          </div>
        </div>

        {/* Proposal sent */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-accent-50 dark:bg-accent-800/45 text-accent-600 dark:text-accent-200 flex items-center justify-center shrink-0">
            <Send size={20} strokeWidth={2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-primary-500 dark:text-primary-200">Proposal sent</span>
            <span className="text-2xl font-bold text-primary-800 dark:text-primary-50 leading-tight mt-0.5">{proposalSentCount}</span>
          </div>
        </div>

        {/* Deals closed */}
        <div className="flex items-center gap-4 px-3 sm:px-4 py-2 sm:py-1">
          <div className="w-13 h-13 rounded-2xl bg-success-light dark:bg-success-dark/45 text-success-dark dark:text-success-light flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} strokeWidth={2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-primary-500 dark:text-primary-200">Deals closed</span>
            <span className="text-2xl font-bold text-primary-800 dark:text-primary-50 leading-tight mt-0.5">{dealsClosedCount}</span>
          </div>
        </div>
      </div>

      {/* ── 3. View Tabs Strip ────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-1">
        <Tabs value={view} onValueChange={v => setView(v as ViewMode)}>
          <TabsList aria-label="View">
            <TabsTrigger value="list" className="gap-1.5"><List size={14} />List</TabsTrigger>
            <TabsTrigger value="board" className="gap-1.5"><LayoutGrid size={14} />Board</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5"><Calendar size={14} />Calendar</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* A filter toggle, not a view — so a pressed button, not a tab. */}
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={mine}
          onClick={() => setMine(m => !m)}
          className="aria-pressed:bg-ui-selected-bg aria-pressed:text-primary-950 dark:h-9 dark:rounded-lg dark:border dark:border-[var(--ui-control-border)] dark:bg-[var(--ui-surface-elevated)] dark:px-3 dark:text-[var(--ui-body)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)] dark:aria-pressed:border-[var(--ui-menu-active-border)] dark:aria-pressed:bg-[var(--ui-menu-active-bg)] dark:aria-pressed:text-[var(--ui-menu-active-fg)]"
        >
          <User size={14} />
          <span>Assigned to me ·</span>
          <span className="dark:grid dark:min-w-5 dark:place-items-center dark:rounded-full dark:px-1.5 dark:text-[12px] dark:leading-5 dark:bg-[#2C3542] dark:text-[var(--ui-heading)] dark:group-aria-pressed/button:bg-[#C9D0DA] dark:group-aria-pressed/button:text-[var(--ui-menu-active-fg)]">
            {myCount}
          </span>
        </Button>
      </div>

      {truncatedAt && (
        <div className="rounded-xl border border-warning-normal bg-warning-light dark:bg-warning-dark/45 px-4 py-2.5 text-xs text-warning-dark dark:text-warning-light">
          Showing the newest <b>{truncatedAt}</b> records — there are more. Counts, totals and search only cover what&apos;s loaded.
        </div>
      )}

      {/* ── 4. Search & Filter Bar ─────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-primary-400 dark:text-primary-300" />
          <Input
            type="search"
            aria-label="Search records"
            placeholder="Search customer, brand, project #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          aria-label="Priority"
          className="w-auto min-w-32"
          value={fPriority}
          onValueChange={v => setFPriority(v ?? '')}
          options={[
            { value: '', label: 'All priorities' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />

        <Select
          aria-label="Assignee"
          className="w-auto min-w-32"
          value={fAssignee}
          onValueChange={v => setFAssignee(v ?? '')}
          options={[
            { value: '', label: 'All assignees' },
            { value: '__none__', label: 'Unassigned' },
            ...assignees.map(a => ({ value: a.id, label: a.full_name })),
          ]}
        />

        <Select
          aria-label="Region"
          className="w-auto min-w-32"
          value={fRegion}
          onValueChange={v => setFRegion(v ?? '')}
          options={[{ value: '', label: 'All regions' }, ...REGIONS.map(r => ({ value: r.code, label: r.label }))]}
        />

        <Select
          aria-label="Sort"
          className="w-auto min-w-32"
          value={sortBy}
          onValueChange={v => setSortBy(v ?? 'created_desc')}
          options={[
            { value: 'created_desc', label: 'Newest first' },
            { value: 'created_asc', label: 'Oldest first' },
            { value: 'deal_desc', label: 'Deal size (high→low)' },
            { value: 'priority', label: 'Priority' },
          ]}
        />

        {view === 'list' && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              aria-expanded={colsOpen}
              className="dark:h-9 dark:rounded-lg dark:px-3"
              onClick={e => { e.stopPropagation(); setColsOpen(o => !o); }}
            >
              <Columns3 size={13} />
              <span>Columns</span>
              <ChevronDown size={13} />
            </Button>
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

        {archivedCount > 0 && (
          <Button variant="outline" size="sm" aria-pressed={showArchived} onClick={() => setShowArchived(a => !a)}>
            <Archive size={13} />
            {showArchived ? 'Hide' : 'Show'} archived · {archivedCount}
          </Button>
        )}

        {selectedStage && (
          <Button variant="link" size="sm" onClick={() => setSelectedStage(null)}>
            Clear stage filter
          </Button>
        )}

        <span className="text-xs text-primary-400 dark:text-primary-300 font-medium ml-auto">
          {visibleLeads.length} shown
        </span>
      </div>

      {/* ── 5. Main 2-Column Section (Table Area + Pipeline Stages Sidebar) ── */}
      <div className="flex items-start gap-5">
        {/* Left Side: Opportunities Table / Board View */}
        <div className={view === 'list' ? 'flex-1 min-w-0' : 'flex-1 min-w-0 bg-ui-surface-elevated border border-ui-divider rounded-2xl shadow-2xs overflow-hidden'}>
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

        {/* ── Right Side: Pipeline Stages Sidebar ───────────────────── */}
        <div className="hidden xl:block w-64 shrink-0 bg-ui-surface-elevated border border-ui-divider rounded-2xl p-4.5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-primary-800 dark:text-primary-50 uppercase tracking-wider">
              Pipeline stages
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-primary-400 dark:text-primary-300">
              <Link href="/settings" className={buttonVariants({ variant: 'ghost', size: 'xs', className: 'text-primary-400 dark:text-primary-300 hover:text-primary-700' })}>
                <Settings size={13} />
                <span>Set</span>
              </Link>
              <Link href="/leads/trash" className={buttonVariants({ variant: 'ghost', size: 'xs', className: 'text-primary-400 dark:text-primary-300 hover:text-primary-700' })}>
                <Trash2 size={13} />
                <span>Trash</span>
              </Link>
            </div>
          </div>

          {/* Stage list with progress bar & counts */}
          <div className="space-y-2.5">
            {ALL_PIPELINE_STAGES.filter(st => (counts[st.key] ?? 0) > 0 || selectedStage === st.key).map((s) => {
              const count = counts[s.key] ?? 0;
              const stageColor = `var(--status-${opportunityTagTone(s.key)}-fg)`;
              const isFiltered = selectedStage === s.key;
              const pct = count > 0 ? Math.min(100, Math.round((count / maxStageCount) * 100)) : 0;

              return (
                <div
                  key={s.key}
                  onClick={() => setSelectedStage(prev => prev === s.key ? null : s.key)}
                  className={`flex items-center justify-between gap-3 text-xs py-1 px-1.5 rounded-lg transition-colors cursor-pointer ${isFiltered ? 'bg-ui-selected-bg font-bold' : 'hover:bg-primary-50 dark:hover:bg-primary-700'
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stageColor }} />
                    <span className="truncate text-primary-700 dark:text-primary-100 font-medium text-[12px]">{s.label}</span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-14 h-1.5 bg-primary-100 dark:bg-primary-700 rounded-full overflow-hidden">
                      {count > 0 && (
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: stageColor }}
                        />
                      )}
                    </div>
                    <span className="text-primary-800 dark:text-primary-50 font-bold text-xs w-4 text-right">{count}</span>
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
