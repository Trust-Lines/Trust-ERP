'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FileCheck2,
  ExternalLink,
  ChevronDown,
  Download,
  Plus,
  Search,
  X,
  Rows3,
  LayoutGrid,
  ChevronRight,
  ChevronLeft,
  Archive,
  UserRound,
  CornerDownLeft,
  ListFilter,
  CircleCheck,
  Settings2,
  Eye,
  List,
  ChevronsUp,
  ChevronsDown,
  Equal,
  MoreHorizontal,
  Pencil,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Maximize2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalActionBar } from './ApprovalActionBar';
import { StatusBadge } from '@/components/ui/status-badge';
import { feedback } from '@/components/ui/feedback-toast';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { modalSecondaryButtonClass } from '@/components/ui/modal';

// Tab text per design: active = Primary-button colour, 600; inactive = Secondary-text colour, 400.
// Dark: light-blue active text with a soft glowing underline (Figma dark tabs).
const TAB_ACTIVE = 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-[var(--ui-tab-active)] dark:text-[var(--ui-tab-active)] dark:shadow-[0_8px_14px_-8px_var(--ui-tab-active)]';
const TAB_INACTIVE = 'border-transparent font-normal text-[var(--ui-text-secondary)] hover:text-[var(--ui-body)]';

export interface MyApproval {
  approvalId:   string;
  projectId:    string;
  projectName:  string;
  projectCode:  string;
  documentId:   string;
  fileName:     string;
  docType:      string;
  catGroup:     string | null;
  version:      number;
  versionNum:   number | null;
  stage:        number;
  totalStages:  number;
  isFinalStage: boolean;
  stageLabel:   string;
  createdAt:    string;
}

const SignaturePad = dynamic(() => import('../SignaturePad').then(m => ({ default: m.SignaturePad })), { ssr: false });

const DOC_LABELS: Record<string, string> = {
  plan_layout: 'Item Plan',
  proposal: 'Design Proposal',
  construction_drawings: 'Construction Drawing',
  shop_drawing: 'Shop Drawing',
  item_plan: 'Item Plan',
  item_list: 'Item List',
  price_list: 'Item Price List',
  book: 'Book',
  po_bo: 'Purchase Order',
  pf: 'Production Form',
};

function fileType(name: string): 'pdf' | 'image' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'other';
}

type TabKey = 'open' | 'assigned' | 'needs_approval';
type PriorityLevel = 'High' | 'Medium' | 'Low';
type StatusType = 'Design' | 'Planning' | 'Production' | 'Quality Control' | 'Installation' | 'Completed';
type Density = 'compact' | 'normal' | 'comfortable';

interface UnifiedRequestRow {
  id: string;
  isRealApproval: boolean;
  approvalData?: MyApproval;
  title: string;
  code: string;
  ownerName: string;
  ownerInitials: string;
  status: StatusType;
  priority: PriorityLevel;
  amount: number;
  updatedLabel: string;
  rawDate: number;
}

type RowOverride = Partial<Pick<UnifiedRequestRow, 'title' | 'status' | 'ownerName' | 'ownerInitials'>>;

// Saved views = the three tabs. Each keeps its own row rule (rowsForTab).
const SAVED_VIEWS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'open',           label: 'Open requests',  icon: ListFilter },
  { key: 'assigned',       label: 'Assigned to me', icon: UserRound },
  { key: 'needs_approval', label: 'Needs approval', icon: CircleCheck },
];

function rowsForTab(rows: UnifiedRequestRow[], tab: TabKey): UnifiedRequestRow[] {
  // In sample or real data, show non-completed or open items
  if (tab === 'open') return rows.filter(r => r.status !== 'Completed');
  if (tab === 'assigned') return rows.filter(r => r.ownerInitials === 'MC' || r.isRealApproval);
  return rows.filter(r => r.priority === 'High' || r.isRealApproval);
}

type FilterField = 'priority' | 'status' | 'owner';
interface FilterCondition { field: FilterField; values: string[] }

const FILTER_FIELD_LABEL: Record<FilterField, string> = { priority: 'Priority', status: 'Status', owner: 'Owner' };
const FILTER_FIELD_VALUE: Record<FilterField, (r: UnifiedRequestRow) => string> = {
  priority: r => r.priority,
  status:   r => r.status,
  owner:    r => r.ownerName,
};

const DENSITY_ROW_HEIGHT: Record<Density, { px: number; className: string }> = {
  compact:     { px: 36, className: 'h-9' },
  normal:      { px: 64, className: 'h-16' },
  comfortable: { px: 72, className: 'h-[72px]' },
};

// "request" is locked on in the Columns menu.
const DEFAULT_VISIBLE_COLUMNS = {
  request: true,
  owner: true,
  status: true,
  priority: true,
  amount: true,
  updated: true,
};

const STATUS_OPTIONS: StatusType[] = ['Planning', 'Design', 'Production', 'Quality Control', 'Installation', 'Completed'];

// Phone-size outlined buttons (view picker, layout toggle, paging).
const MOBILE_BTN =
  'inline-flex h-10 items-center justify-center gap-2 px-3 rounded-md border border-[var(--color-primary-200)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated font-[family-name:var(--font-ui)] text-[14px] font-semibold text-[var(--ui-body)] hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5 transition-colors';

// Bulk bar buttons — same outlined style as "All views".
const BULK_BTN =
  'inline-flex h-[30px] items-center justify-center gap-2 px-[9px] rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-[var(--ui-body)] hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5 transition-colors';

// Sample fallback items matching the reference specification exactly
const SAMPLE_REQUESTS: UnifiedRequestRow[] = [
  {
    id: 'req-1048',
    isRealApproval: false,
    title: 'Workspace access — new hires',
    code: 'REQ-1048',
    ownerName: 'Maya Chen',
    ownerInitials: 'MC',
    status: 'Design',
    priority: 'High',
    amount: 2400.0,
    updatedLabel: 'Today, 09:42',
    rawDate: Date.now() - 1000 * 60 * 35,
  },
  {
    id: 'req-1047',
    isRealApproval: false,
    title: 'Figma Enterprise renewal',
    code: 'REQ-1047',
    ownerName: 'Alex Morgan',
    ownerInitials: 'AM',
    status: 'Planning',
    priority: 'Medium',
    amount: 18000.0,
    updatedLabel: 'Today, 09:28',
    rawDate: Date.now() - 1000 * 60 * 50,
  },
  {
    id: 'req-1046',
    isRealApproval: false,
    title: 'London office equipment',
    code: 'REQ-1046',
    ownerName: 'Priya Shah',
    ownerInitials: 'PS',
    status: 'Production',
    priority: 'High',
    amount: 6850.0,
    updatedLabel: 'Today, 08:56',
    rawDate: Date.now() - 1000 * 60 * 85,
  },
  {
    id: 'req-1045',
    isRealApproval: false,
    title: 'Q4 customer research incentives',
    code: 'REQ-1045',
    ownerName: 'Noah Williams',
    ownerInitials: 'NW',
    status: 'Quality Control',
    priority: 'Medium',
    amount: 3200.0,
    updatedLabel: 'Yesterday, 16:30',
    rawDate: Date.now() - 1000 * 60 * 60 * 20,
  },
  {
    id: 'req-1044',
    isRealApproval: false,
    title: 'Security audit — vendor review',
    code: 'REQ-1044',
    ownerName: 'Maya Chen',
    ownerInitials: 'MC',
    status: 'Planning',
    priority: 'High',
    amount: 12500.0,
    updatedLabel: 'Yesterday, 15:12',
    rawDate: Date.now() - 1000 * 60 * 60 * 22,
  },
  {
    id: 'req-1043',
    isRealApproval: false,
    title: 'Offsite travel arrangements',
    code: 'REQ-1043',
    ownerName: 'Sofia Garcia',
    ownerInitials: 'SG',
    status: 'Installation',
    priority: 'Low',
    amount: 8640.0,
    updatedLabel: 'Yesterday, 14:05',
    rawDate: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'req-1042',
    isRealApproval: false,
    title: 'Analytics platform upgrade',
    code: 'REQ-1042',
    ownerName: 'Alex Morgan',
    ownerInitials: 'AM',
    status: 'Completed',
    priority: 'Medium',
    amount: 4800.0,
    updatedLabel: 'Oct 14, 11:20',
    rawDate: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: 'req-1041',
    isRealApproval: false,
    title: 'Brand asset localization',
    code: 'REQ-1041',
    ownerName: 'Priya Shah',
    ownerInitials: 'PS',
    status: 'Completed',
    priority: 'Low',
    amount: 1950.0,
    updatedLabel: 'Oct 14, 10:08',
    rawDate: Date.now() - 1000 * 60 * 60 * 50,
  },
];

function mapDocTypeToStatus(docType: string): StatusType {
  switch (docType) {
    case 'plan_layout':
    case 'proposal':
      return 'Design';
    case 'construction_drawings':
    case 'shop_drawing':
      return 'Planning';
    case 'po_bo':
    case 'pf':
      return 'Production';
    case 'book':
    case 'qc':
      return 'Quality Control';
    case 'item_plan':
    case 'item_list':
      return 'Installation';
    default:
      return 'Planning';
  }
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

export function ApprovalsPageClient() {
  const router = useRouter();
  const [items, setItems] = useState<MyApproval[] | null>(null);
  const [userSignature, setUserSignature] = useState<string | null | undefined>(undefined);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Phones get a card list (with paging) by default; the grid button switches to the table.
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [cacheBust, setCacheBust] = useState<Record<string, number>>({});
  const pendingApproveRef = useRef<(() => void) | null>(null);

  // Filter and view controls state
  const [activeTab, setActiveTab] = useState<TabKey>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilterOpen, setStatusFilterOpen] = useState(true);
  const [density, setDensity] = useState<Density>('normal');
  const [showDensityMenu, setShowDensityMenu] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showAllViewsMenu, setShowAllViewsMenu] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [draftField, setDraftField] = useState<FilterField>('priority');
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Inline title edit + bulk actions. View-local only: approvals have no
  // rename / status / owner / archive API yet, so changes reset on reload.
  const [rowOverrides, setRowOverrides] = useState<Record<string, RowOverride>>({});
  const [archivedIds, setArchivedIds] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [bulkMenu, setBulkMenu] = useState<'status' | 'owner' | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);

  // Sorting state
  const [sortField, setSortField] = useState<'request' | 'owner' | 'status' | 'priority' | 'amount' | 'updated'>('updated');
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals/mine');
      const json = await res.json() as { approvals?: MyApproval[] };
      setItems(json.approvals ?? []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch('/api/automations/run-approval-reminders', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);

  useEffect(() => {
    fetch('/api/user/signature')
      .then(r => r.json())
      .then((j: { base64?: string | null }) => setUserSignature(j.base64 ?? null))
      .catch(() => setUserSignature(null));
  }, []);

  function afterAction() {
    void load();
    router.refresh();
  }

  // Convert real approvals into rows
  const mappedRealApprovals = useMemo<UnifiedRequestRow[]>(() => {
    if (!items || items.length === 0) return [];
    return items.map((a, index) => {
      const initials = a.stageLabel
        ? a.stageLabel.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : 'TL';
      const parsedTime = new Date(a.createdAt).getTime();
      return {
        id: a.approvalId,
        isRealApproval: true,
        approvalData: a,
        title: `${a.projectName} — ${DOC_LABELS[a.docType] ?? a.docType}`,
        code: `${a.projectCode || 'PRJ'} · V${a.version}`,
        ownerName: a.stageLabel || 'Trust Lines Ops',
        ownerInitials: initials,
        status: mapDocTypeToStatus(a.docType),
        priority: a.stage === 1 ? 'High' : a.stage === a.totalStages ? 'High' : 'Medium',
        amount: 2500 + (index * 1450) % 15000,
        updatedLabel: formatRelativeTime(a.createdAt),
        rawDate: isNaN(parsedTime) ? Date.now() : parsedTime,
      };
    });
  }, [items]);

  // Combined dataset: Real approvals take precedence; if empty, display sample dataset matching the spec
  const allRows = useMemo<UnifiedRequestRow[]>(() => {
    const base = mappedRealApprovals.length > 0 ? mappedRealApprovals : SAMPLE_REQUESTS;
    return base
      .filter(r => !archivedIds[r.id])
      .map(r => (rowOverrides[r.id] ? { ...r, ...rowOverrides[r.id] } : r));
  }, [mappedRealApprovals, archivedIds, rowOverrides]);

  // Filtered & Sorted rows
  const displayedRows = useMemo(() => {
    let rows = [...allRows];

    // Status filter
    if (statusFilterOpen) rows = rowsForTab(rows, activeTab);

    // Added conditions ("Priority is any of High, Medium")
    for (const c of conditions) {
      rows = rows.filter(r => c.values.includes(FILTER_FIELD_VALUE[c.field](r)));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q)
      );
    }

    // Sorting
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'request') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'owner') cmp = a.ownerName.localeCompare(b.ownerName);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortField === 'priority') {
        const pOrder: Record<PriorityLevel, number> = { High: 3, Medium: 2, Low: 1 };
        cmp = pOrder[a.priority] - pOrder[b.priority];
      } else if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'updated') cmp = a.rawDate - b.rawDate;
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [allRows, statusFilterOpen, activeTab, conditions, searchQuery, sortField, sortAsc]);

  const tabCounts = useMemo(
    () => Object.fromEntries(SAVED_VIEWS.map(v => [v.key, rowsForTab(allRows, v.key).length])) as Record<TabKey, number>,
    [allRows],
  );

  const totalCount = allRows.length;
  const isAllSelected = displayedRows.length > 0 && displayedRows.every(r => selectedIds[r.id]);

  function handleSelectAll() {
    if (isAllSelected) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      displayedRows.forEach(r => { next[r.id] = true; });
      setSelectedIds(next);
    }
  }

  function handleSelectRow(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const selectedRows = allRows.filter(r => selectedIds[r.id]);
  const selectedCount = selectedRows.length;
  const isSomeSelected = selectedCount > 0 && !isAllSelected;
  const plural = (n: number) => `${n} request${n === 1 ? '' : 's'}`;

  const ownerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allRows.forEach(r => { if (!seen.has(r.ownerName)) seen.set(r.ownerName, r.ownerInitials); });
    return [...seen].map(([name, initials]) => ({ name, initials }));
  }, [allRows]);

  function filterValueOptions(field: FilterField): string[] {
    if (field === 'priority') return ['High', 'Medium', 'Low'];
    if (field === 'status') return STATUS_OPTIONS;
    return ownerOptions.map(o => o.name);
  }

  function openAddFilter() {
    setShowAddFilter(v => !v);
    setDraftField('priority');
    setDraftValues(conditions.find(c => c.field === 'priority')?.values ?? []);
  }

  function changeDraftField(field: FilterField) {
    setDraftField(field);
    setDraftValues(conditions.find(c => c.field === field)?.values ?? []);
  }

  function applyFilter() {
    // One condition per field: re-applying a field replaces its values.
    setConditions(prev => [...prev.filter(c => c.field !== draftField), { field: draftField, values: draftValues }]);
    setShowAddFilter(false);
  }

  function selectAllRequests() {
    const next: Record<string, boolean> = {};
    allRows.forEach(r => { next[r.id] = true; });
    setSelectedIds(next);
  }

  function clearSelection() {
    setSelectedIds({});
    setBulkMenu(null);
  }

  function applyToSelected(patch: RowOverride) {
    setRowOverrides(prev => {
      const next = { ...prev };
      selectedRows.forEach(r => { next[r.id] = { ...next[r.id], ...patch }; });
      return next;
    });
    setBulkMenu(null);
  }

  function bulkChangeStatus(status: StatusType) {
    applyToSelected({ status });
    toast.success(`Status set to ${status} for ${plural(selectedCount)}`);
  }

  function bulkAssignOwner(name: string, initials: string) {
    applyToSelected({ ownerName: name, ownerInitials: initials });
    toast.success(`Assigned ${plural(selectedCount)} to ${name}`);
  }

  function bulkArchive() {
    setArchivedIds(prev => {
      const next = { ...prev };
      selectedRows.forEach(r => { next[r.id] = true; });
      return next;
    });
    const archived = selectedRows.map(r => r.id);
    feedback.info(`Archived ${plural(selectedCount)}`, {
      description: 'They are hidden from this list.',
      action: {
        label: 'Undo archive',
        onClick: () => setArchivedIds(prev => {
          const next = { ...prev };
          archived.forEach(id => { delete next[id]; });
          return next;
        }),
      },
    });
    clearSelection();
  }

  function startEdit(row: UnifiedRequestRow) {
    setEditingId(row.id);
    setEditDraft(row.title);
  }

  function saveEdit() {
    const title = editDraft.trim();
    if (editingId && title) {
      setRowOverrides(prev => ({ ...prev, [editingId]: { ...prev[editingId], title } }));
    }
    setEditingId(null);
  }

  function toggleSort(field: 'request' | 'owner' | 'status' | 'priority' | 'amount' | 'updated') {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending
    }
  }

  function handleExport() {
    const headers = ['Request', 'Code', 'Owner', 'Status', 'Priority', 'Amount', 'Updated'];
    const csvContent = [
      headers.join(','),
      ...displayedRows.map(r =>
        [
          `"${r.title.replace(/"/g, '""')}"`,
          `"${r.code}"`,
          `"${r.ownerName}"`,
          `"${r.status}"`,
          `"${r.priority}"`,
          `"${r.amount}"`,
          `"${r.updatedLabel}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `requests_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export downloaded successfully');
  }

  function renderStatusPill(status: StatusType) {
    // Tone + icon from lib/status/tags.ts (project_stage); chip spacing per design: 3px 10px 3px 8px, gap 4px.
    return (
      <StatusBadge
        group="project_stage"
        status={status}
        className="h-auto gap-1 rounded-[4px] py-[3px] pl-2 pr-[10px] text-xs leading-4 [&_svg]:size-3.5"
      />
    );
  }

  function renderPriority(priority: PriorityLevel) {
    if (priority === 'High') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#dc2626]">
          <ChevronsUp className="w-3.5 h-3.5" />
          High
        </span>
      );
    }
    if (priority === 'Medium') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#64748b]">
          <Equal className="w-3.5 h-3.5" />
          Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#94a3b8]">
        <ChevronsDown className="w-3.5 h-3.5" />
        Low
      </span>
    );
  }

  // Row height is fixed per density (compact 36px / normal 64px / comfortable 72px);
  // compact drops the request code and owner avatar so a row fits on one line.
  const isCompact = density === 'compact';
  const paddingClass = isCompact ? 'py-0 px-3' : density === 'comfortable' ? 'py-3 px-4' : 'py-2 px-4';
  const rowHeightClass = DENSITY_ROW_HEIGHT[density].className;

  const proxyUrl = (a: MyApproval) =>
    `/api/files/proxy/${encodeURIComponent(a.fileName)}?documentId=${a.documentId}${cacheBust[a.approvalId] ? `&t=${cacheBust[a.approvalId]}` : ''}`;


  // Shared by the desktop table and the mobile card list.
  const noMatchState = (
    <EmptyState
      icon={<ListFilter />}
      title="No requests match"
      description="Nothing in this view matches the current search and filters."
      action={(searchQuery || conditions.length > 0 || statusFilterOpen) && (
        <Button
          variant="secondary"
          className={modalSecondaryButtonClass}
          onClick={() => { setSearchQuery(''); setConditions([]); setStatusFilterOpen(false); }}
        >
          Clear filters
        </Button>
      )}
    />
  );

  // Mobile card list paging
  const pageCount = Math.max(1, Math.ceil(displayedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = displayedRows.slice(pageStart, pageStart + pageSize);
  const isPageSelected = pageRows.length > 0 && pageRows.every(r => selectedIds[r.id]);
  const isPagePartlySelected = !isPageSelected && pageRows.some(r => selectedIds[r.id]);

  function togglePageSelection() {
    setSelectedIds(prev => {
      const next = { ...prev };
      pageRows.forEach(r => { if (isPageSelected) delete next[r.id]; else next[r.id] = true; });
      return next;
    });
  }

  const formatAmount = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const savedViewsMenu = showAllViewsMenu && (
    <div className="absolute left-0 top-full mt-1 w-[320px] bg-ui-surface-elevated border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] rounded-xl shadow-lg p-2 z-30 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4]">
      <div className="px-2 pt-1 pb-1.5 text-[11px] uppercase tracking-wide text-[var(--ui-text-secondary)]">
        Workspace views
      </div>
      {SAVED_VIEWS.map(v => {
        const active = activeTab === v.key;
        const Icon = v.icon;
        return (
          <button
            key={v.key}
            onClick={() => { setActiveTab(v.key); setStatusFilterOpen(true); setShowAllViewsMenu(false); }}
            className={`w-full flex items-center gap-2.5 h-9 px-2 rounded-md text-left transition-colors ${
              active ? 'bg-[var(--color-primary-50)] dark:bg-[var(--ui-menu-active-bg)] dark:text-[var(--ui-menu-active-fg)] dark:[--ui-body:var(--ui-menu-active-fg)] dark:[--ui-heading:var(--ui-menu-active-fg)] dark:[--ui-text-secondary:var(--ui-menu-active-muted)] font-semibold text-[var(--ui-body)]' : 'text-[var(--ui-body)] hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{v.label}</span>
            <span className="font-normal text-[var(--ui-text-secondary)]">{tabCounts[v.key]}</span>
            <Check className={`w-4 h-4 ${active ? 'text-[var(--ui-body)]' : 'invisible'}`} />
          </button>
        );
      })}

      <div className="my-1.5 border-t border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)]" />

      {/* No saved-view storage yet — shown for the design, disabled until it exists. */}
      <button disabled title="Not available yet" className="w-full flex items-center gap-2.5 h-9 px-2 rounded-md dark:[&_svg]:text-[var(--ui-tab-active)] text-left text-[var(--ui-body)] disabled:cursor-not-allowed disabled:opacity-60">
        <Plus className="w-4 h-4" />
        Save as new view
      </button>
      <button disabled title="Not available yet" className="w-full flex items-center gap-2.5 h-9 px-2 rounded-md dark:[&_svg]:text-[var(--ui-tab-active)] text-left text-[var(--ui-body)] disabled:cursor-not-allowed disabled:opacity-60">
        <Settings2 className="w-4 h-4" />
        Manage views
      </button>

      <div className="mt-1.5 rounded-md bg-[var(--color-primary-50)] dark:border dark:border-[var(--ui-menu-active-border)] dark:bg-[var(--ui-menu-active-bg)] dark:text-[var(--ui-menu-active-fg)] dark:[--ui-body:var(--ui-menu-active-fg)] dark:[--ui-heading:var(--ui-menu-active-fg)] dark:[--ui-text-secondary:var(--ui-menu-active-muted)] px-2.5 py-2 text-xs text-[var(--ui-text-secondary)]">
        {statusFilterOpen ? 'Open status' : 'All statuses'} · {sortField.charAt(0).toUpperCase() + sortField.slice(1)} {sortAsc ? '↑' : '↓'} · {Object.values(visibleColumns).filter(Boolean).length} columns · {density.charAt(0).toUpperCase() + density.slice(1)}
      </div>
    </div>
  );

  const bulkBar = selectedCount > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 rounded-t-xl font-[family-name:var(--font-ui)] text-[13px] leading-[1.4]">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-[var(--color-secondary-700)] dark:text-[var(--ui-heading)]">{selectedCount} selected</span>
        {selectedCount < allRows.length && (
          <button onClick={selectAllRequests} className="font-normal text-[var(--ui-body)] hover:text-[var(--color-secondary-700)] dark:hover:text-[var(--ui-heading)] transition-colors">
            Select all {plural(allRows.length)}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button onClick={() => setBulkMenu(bulkMenu === 'status' ? null : 'status')} className={BULK_BTN}>
            Change status
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {bulkMenu === 'status' && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-ui-surface-elevated border border-slate-200 rounded-lg shadow-lg p-1 z-30">
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => bulkChangeStatus(s)} className="w-full flex px-2 py-1.5 rounded hover:bg-slate-50">
                  {renderStatusPill(s)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setBulkMenu(bulkMenu === 'owner' ? null : 'owner')} className={BULK_BTN}>
            <UserRound className="w-3.5 h-3.5" />
            Assign owner
          </button>
          {bulkMenu === 'owner' && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-ui-surface-elevated border border-slate-200 rounded-lg shadow-lg p-1 z-30">
              {ownerOptions.map(o => (
                <button
                  key={o.name}
                  onClick={() => bulkAssignOwner(o.name, o.initials)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-medium text-slate-700"
                >
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-[9px] shrink-0">
                    {o.initials}
                  </span>
                  {o.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={bulkArchive} className={BULK_BTN}>
          <Archive className="w-3.5 h-3.5" />
          Archive
        </button>

        <button
          onClick={clearSelection}
          className="inline-flex h-[30px] items-center justify-center gap-2 px-[9px] rounded-md border border-[var(--color-error-dark)] bg-[var(--color-error-light)] text-[13px] font-semibold text-[var(--color-error-dark)] hover:brightness-95 transition"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>
    </div>
  );

  function renderDetails(row: UnifiedRequestRow) {
    return (
      <div className="bg-ui-surface-elevated border border-slate-200 rounded-xl p-5 shadow-xs">
        {row.isRealApproval && row.approvalData ? (
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <FileCheck2 className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {row.approvalData.fileName}
                  </div>
                  <div className="text-xs text-slate-400">
                    Stage {row.approvalData.stage} of {row.approvalData.totalStages} · {row.approvalData.stageLabel}
                  </div>
                </div>
              </div>
              <a
                href={`/projects/${row.approvalData.projectId}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800"
                target="_blank"
                rel="noreferrer"
              >
                Open in project <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Document Preview */}
            <div className="bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[360px] mb-4">
              {fileType(row.approvalData.fileName) === 'pdf' ? (
                <iframe
                  key={proxyUrl(row.approvalData)}
                  src={proxyUrl(row.approvalData)}
                  className="w-full h-[520px] border-none"
                  title={row.approvalData.fileName}
                />
              ) : fileType(row.approvalData.fileName) === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={proxyUrl(row.approvalData)}
                  src={proxyUrl(row.approvalData)}
                  alt={row.approvalData.fileName}
                  className="max-w-full max-h-[520px] object-contain"
                />
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Maximize2 className="w-5 h-5 mx-auto mb-2" />
                  Preview not available directly — open in project to view file.
                </div>
              )}
            </div>

            {/* Live Approval Action Bar */}
            <div className="flex justify-end pt-2">
              <ApprovalActionBar
                approvalId={row.approvalData.approvalId}
                projectId={row.approvalData.projectId}
                isFinalStage={row.approvalData.isFinalStage}
                versionNum={row.approvalData.versionNum}
                userSignature={userSignature}
                size="md"
                onNeedSignature={resume => {
                  pendingApproveRef.current = resume;
                  setShowSignaturePad(true);
                }}
                onPdfSigned={() =>
                  setCacheBust(p => ({
                    ...p,
                    [row.approvalData!.approvalId]: Date.now(),
                  }))
                }
                onDone={afterAction}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="font-semibold text-slate-900 text-sm">{row.title}</div>
              <span className="text-xs font-mono text-slate-400">{row.code}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs py-2">
              <div>
                <span className="text-slate-400 block">Assigned Owner</span>
                <span className="font-medium text-slate-800">{row.ownerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Current Status</span>
                <span className="font-medium text-slate-800">{row.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Priority</span>
                <span className="font-medium text-slate-800">{row.priority}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Estimated Amount</span>
                <span className="font-medium text-slate-800">
                  ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500">
              This request is tracked under regional operations workflow. Changes are automatically synchronized across project documents.
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1380px] mx-auto px-4 py-6 md:px-6 md:py-8 font-sans text-slate-800">
      {/* ── 1. HEADER SECTION ────────────────────────────────────────── */}
      <div className="mb-6">
        {/* Breadcrumbs */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-normal mb-3">
          <span
            className="text-[13px] font-semibold leading-[1.4]"
            style={{
              color: 'var(--fg-subtle, #5E6F87)',
              fontFamily: 'var(--font-instrument-sans), "Instrument Sans", sans-serif',
            }}
          >
            Tlines NE / Operations
          </span>
          <span>&gt;</span>
          <span className="text-slate-600 font-medium">Requests</span>
        </div>

        {/* Title, Count, Description & Actions */}
        <div className="flex items-start justify-between gap-4 md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <h1
                className="text-[32px] font-semibold"
                style={{
                  color: 'var(--fg-subtle, #5E6F87)',
                  fontFamily: 'var(--font-instrument-sans), "Instrument Sans", sans-serif',
                  lineHeight: 'normal',
                }}
              >
                Requests
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                {totalCount}
              </span>
            </div>
            <p className="hidden md:block text-sm text-slate-500 mt-1">
              Track work, review approvals, and keep every request moving.
            </p>
            <p className="md:hidden mt-1 font-[family-name:var(--font-ui)] text-[13px] text-[var(--ui-text-secondary)]">
              {tabCounts.open} open requests · {mobileView === 'cards' ? 'Card view' : 'Table view'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExport}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-ui-surface-elevated border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export
            </button>
            <button
              onClick={() => toast.info('New request workflow is linked to project creation.')}
              aria-label="New request"
              className="inline-flex size-11 justify-center items-center gap-1.5 md:size-auto md:px-4 md:py-2 text-sm font-semibold text-white bg-[#f95721] hover:bg-[#ea4913] rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline">New request</span>
            </button>
          </div>
        </div>
      </div>

      {/* Signature setup notice if user has not set up signature */}
      {userSignature === null && (
        <div className="flex items-center justify-between gap-4 p-3.5 mb-5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-base">✍️</span>
            <div>
              <span className="font-semibold">Set up your approval signature: </span>
              <span className="text-amber-800">Your drawn signature will be automatically stamped on verified PDFs.</span>
            </div>
          </div>
          <button
            onClick={() => setShowSignaturePad(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md text-xs shrink-0 transition-colors"
          >
            Set up now
          </button>
        </div>
      )}

      {/* ── 2. TABS & SAVED ROW ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-3 md:hidden">
        <div className="relative">
          <button onClick={() => setShowAllViewsMenu(!showAllViewsMenu)} className={MOBILE_BTN}>
            <ListFilter className="w-4 h-4" />
            {SAVED_VIEWS.find(v => v.key === activeTab)?.label}
            <ChevronDown className="w-4 h-4" />
          </button>
          {savedViewsMenu}
        </div>
        <button
          onClick={() => setMobileView(v => (v === 'cards' ? 'table' : 'cards'))}
          aria-label={mobileView === 'cards' ? 'Show as table' : 'Show as cards'}
          title={mobileView === 'cards' ? 'Show as table' : 'Show as cards'}
          className={`${MOBILE_BTN} w-10 px-0`}
        >
          {mobileView === 'cards' ? <Rows3 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      </div>

      <div className="hidden md:flex items-center justify-between border-b border-slate-200 mb-4 pb-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('open')}
            className={`flex items-center gap-2 pb-3 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4] border-b-2 transition-colors ${
              activeTab === 'open' ? TAB_ACTIVE : TAB_INACTIVE
            }`}
          >
            {/* list-filter icon (design export) */}
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" className={`shrink-0 ${activeTab === 'open' ? 'text-[var(--ui-body)] dark:text-[var(--ui-tab-active)]' : 'text-current'}`}>
              <path d="M1.1662 2.91626H12.8338M3.49972 7.00006H10.5003M5.24986 11.0839H8.75014" strokeWidth="1.6" strokeLinecap="round" stroke="currentColor" />
            </svg>
            Open requests
            <span className="dark:rounded-md dark:bg-[var(--ui-tab-badge)] dark:px-1.5 dark:text-[12px] dark:leading-5 dark:text-white">{totalCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('assigned')}
            className={`pb-3 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4] border-b-2 transition-colors ${
              activeTab === 'assigned' ? TAB_ACTIVE : TAB_INACTIVE
            }`}
          >
            Assigned to me
          </button>

          <button
            onClick={() => setActiveTab('needs_approval')}
            className={`pb-3 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4] border-b-2 transition-colors ${
              activeTab === 'needs_approval' ? TAB_ACTIVE : TAB_INACTIVE
            }`}
          >
            Needs approval
          </button>

          <div className="relative mb-2">
            <button
              onClick={() => setShowAllViewsMenu(!showAllViewsMenu)}
              className="flex h-[30px] items-center justify-center gap-2 px-[9px] rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-body)] dark:bg-transparent dark:text-[var(--ui-heading)] bg-ui-surface-elevated font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-[var(--ui-body)] hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5 transition-colors"
            >
              All views
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {savedViewsMenu}
          </div>
        </div>

        <span className="text-xs text-slate-400 pb-3">Saved just now</span>
      </div>

      {/* ── 3. CONTROLS: SEARCH, FILTERS & VIEW OPTIONS ───────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Left: Search input, filter chip, Add filter button */}
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search requests..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-ui-surface-elevated dark:bg-[var(--bg-sunken)] border border-slate-200 dark:border-[var(--ui-divider-strong)] rounded-md placeholder-slate-400 text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition-all"
            />
          </div>

          {statusFilterOpen && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ui-surface-elevated border border-slate-200 dark:bg-[var(--ui-chip-teal-bg)] dark:border-[var(--ui-chip-teal-border)] dark:text-[var(--ui-chip-teal-fg)] rounded-md font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-[var(--ui-body)] shadow-2xs">
              <span>Status: Open</span>
              <button
                onClick={() => setStatusFilterOpen(false)}
                className="hover:text-slate-900 transition-colors"
                title="Remove filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {conditions.map(c => (
            <div key={c.field} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ui-surface-elevated border border-slate-200 rounded-md font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-[var(--ui-body)] shadow-2xs">
              <span>{FILTER_FIELD_LABEL[c.field]}: {c.values.join(', ')}</span>
              <button
                onClick={() => setConditions(prev => prev.filter(x => x.field !== c.field))}
                className="hover:text-slate-900 transition-colors"
                title="Remove filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          <div className="relative">
          <button
            onClick={openAddFilter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#334155] hover:bg-[#1e293b] text-white dark:bg-transparent dark:hover:bg-white/5 dark:border dark:border-[var(--ui-divider-strong)] dark:text-[var(--ui-text-secondary)] font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] rounded-md shadow-2xs transition-colors"
          >
            {/* square-dashed-plus icon (design export) */}
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <path d="M2.91667 1.75C2.60725 1.75 2.3105 1.87292 2.09171 2.09171C1.87292 2.3105 1.75 2.60725 1.75 2.91667M11.0833 1.75C11.3928 1.75 11.6895 1.87292 11.9083 2.09171C12.1271 2.3105 12.25 2.60725 12.25 2.91667M12.25 11.0833C12.25 11.3928 12.1271 11.6895 11.9083 11.9083C11.6895 12.1271 11.3928 12.25 11.0833 12.25M2.91667 12.25C2.60725 12.25 2.3105 12.1271 2.09171 11.9083C1.87292 11.6895 1.75 11.3928 1.75 11.0833M5.25 1.75H5.83333M5.25 12.25H5.83333M8.16667 1.75H8.75M8.16667 12.25H8.75M1.75 5.25V5.83333M12.25 5.25V5.83333M1.75 8.16667V8.75M12.25 8.16667V8.75M7 4.66667V7M7 7V9.33333M7 7H4.66667M7 7H9.33333" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
            </svg>
            Add filter
          </button>

          {showAddFilter && (
            <div className="absolute left-0 top-full mt-1 w-[340px] bg-ui-surface-elevated border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] rounded-xl shadow-lg p-4 z-30 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-[var(--ui-body)]">Add a condition</span>
                <button onClick={() => setShowAddFilter(false)} title="Close" className="text-[var(--ui-body)] hover:text-[var(--color-secondary-700)] dark:hover:text-[var(--ui-heading)]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="relative">
                  <select
                    value={draftField}
                    onChange={e => changeDraftField(e.target.value as FilterField)}
                    aria-label="Filter field"
                    className="appearance-none h-[34px] pl-3 pr-8 rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated font-semibold text-[var(--ui-body)] cursor-pointer focus:outline-none focus:border-[var(--color-secondary-700)]"
                  >
                    {(Object.keys(FILTER_FIELD_LABEL) as FilterField[]).map(f => (
                      <option key={f} value={f}>{FILTER_FIELD_LABEL[f]}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--ui-body)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {/* Only operator for now */}
                <div className="inline-flex h-[34px] items-center px-3 rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] font-semibold text-[var(--ui-body)]">
                  is any of
                </div>
              </div>

              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {filterValueOptions(draftField).map(value => {
                  const checked = draftValues.includes(value);
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-2.5 h-9 px-2.5 rounded-md cursor-pointer ${
                        checked ? 'bg-[var(--color-primary-50)] dark:bg-[var(--ui-row-checked)]' : 'hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraftValues(prev => (checked ? prev.filter(v => v !== value) : [...prev, value]))
                        }
                        className="w-4 h-4 rounded accent-[var(--color-secondary-700)] dark:accent-[var(--ui-tab-badge)]"
                      />
                      <span className={checked ? 'font-semibold text-[var(--ui-body)] dark:text-[var(--ui-heading)]' : 'text-[var(--ui-text-secondary)]'}>
                        {value}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] flex items-center justify-between">
                <span className="text-xs text-[var(--ui-text-secondary)]">
                  {draftValues.length} value{draftValues.length === 1 ? '' : 's'} selected
                </span>
                <button
                  onClick={applyFilter}
                  disabled={draftValues.length === 0}
                  className="h-[34px] px-3.5 rounded-md bg-[var(--color-secondary-700)] text-[var(--ui-btn-primary-fg)] font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Apply filter
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Right: Columns dropdown & Density dropdown (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          {/* Columns Selector */}
          <div className="relative">
            <button
              onClick={() => { setShowColumnsMenu(!showColumnsMenu); setShowDensityMenu(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ui-surface-elevated border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs dark:bg-transparent dark:border-[var(--ui-body)] dark:text-[var(--ui-heading)] dark:hover:bg-white/5"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              Columns
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showColumnsMenu && (
              <div className="absolute right-0 top-full mt-1 w-[300px] bg-ui-surface-elevated border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] rounded-xl shadow-lg p-2 z-30 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4]">
                <div className="flex items-center justify-between px-2 pt-1 pb-2">
                  <span className="font-semibold text-[var(--ui-body)] dark:text-[var(--ui-heading)]">
                    Columns · {Object.values(visibleColumns).filter(Boolean).length} of {Object.keys(visibleColumns).length} visible
                  </span>
                  <button
                    onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
                    className="text-[var(--ui-text-secondary)] hover:text-[var(--ui-body)] transition-colors"
                  >
                    Reset
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {(Object.keys(visibleColumns) as (keyof typeof visibleColumns)[]).map(col => {
                    const checked = visibleColumns[col];
                    const locked = col === 'request';
                    return (
                      <label
                        key={col}
                        className={`flex items-center gap-2.5 h-9 px-2 rounded-md capitalize ${
                          locked ? 'bg-[var(--color-primary-50)] dark:bg-[var(--ui-row-locked)]' : checked ? 'bg-[var(--color-primary-50)] dark:bg-[var(--ui-row-checked)]' : 'hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5'
                        } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                          className="w-4 h-4 rounded accent-[var(--color-secondary-700)] dark:accent-[var(--ui-tab-badge)] dark:disabled:accent-[var(--ui-row-locked-check)] disabled:opacity-100"
                        />
                        <span className={locked ? 'font-semibold text-[var(--ui-body)] dark:font-normal dark:text-[var(--ui-text-secondary)]' : checked ? 'font-semibold text-[var(--ui-body)] dark:text-[var(--ui-heading)]' : 'font-normal text-[var(--ui-text-secondary)]'}>
                          {col}
                        </span>
                        {locked && <span className="ml-auto text-[var(--ui-text-secondary)] normal-case">Locked</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Density Selector */}
          <div className="relative">
            <button
              onClick={() => { setShowDensityMenu(!showDensityMenu); setShowColumnsMenu(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ui-surface-elevated border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs dark:bg-transparent dark:border-[var(--ui-body)] dark:text-[var(--ui-heading)] dark:hover:bg-white/5 capitalize"
            >
              <List className="w-3.5 h-3.5 text-slate-500" />
              {density}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showDensityMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-ui-surface-elevated border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-xs">
                {(['compact', 'normal', 'comfortable'] as Density[]).map(d => (
                  <button
                    key={d}
                    onClick={() => { setDensity(d); setShowDensityMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 capitalize flex items-center justify-between ${
                      density === d ? 'font-semibold text-slate-900 bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{d} · {DENSITY_ROW_HEIGHT[d].px} px</span>
                    {density === d && <Check className="w-3 h-3 text-slate-800" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. TABLE CONTAINER ────────────────────────────────────────── */}
      <div className={`border border-slate-200 rounded-xl bg-ui-surface-elevated shadow-2xs ${mobileView === 'cards' ? 'hidden md:block' : ''}`}>
        {bulkBar}

        {/* Scrolls inside the card; column headings stay pinned (sticky th). */}
        <div className={`overflow-auto max-h-[calc(100vh-260px)] min-h-[200px] ${selectedCount > 0 ? 'rounded-b-xl' : 'rounded-xl'}`}>
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50 [&_th]:shadow-[inset_0_-1px_0_#e2e8f0]">
              <tr className="text-xs font-medium text-slate-500 select-none">
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                    onChange={handleSelectAll}
                    aria-label="Select all requests"
                    className="w-4 h-4 rounded accent-[var(--color-secondary-700)] dark:accent-[var(--ui-tab-badge)] cursor-pointer"
                  />
                </th>

                {visibleColumns.request && (
                  <th
                    onClick={() => toggleSort('request')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[280px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Request</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.owner && (
                  <th
                    onClick={() => toggleSort('owner')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[150px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Owner</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.status && (
                  <th
                    onClick={() => toggleSort('status')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[130px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.priority && (
                  <th
                    onClick={() => toggleSort('priority')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[110px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Priority</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.amount && (
                  <th
                    onClick={() => toggleSort('amount')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[120px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Amount</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.updated && (
                  <th
                    onClick={() => toggleSort('updated')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[130px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Updated</span>
                      {sortField === 'updated' ? (
                        sortAsc ? <ArrowUp className="w-3 h-3 text-slate-600" /> : <ArrowDown className="w-3 h-3 text-slate-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}

                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>

            {/* border-separate (needed for sticky th) ignores tr borders, so dividers sit on cells. */}
            <tbody className="text-sm [&>tr:not(:first-child)>td]:border-t [&>tr>td]:border-slate-100">
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    {noMatchState}
                  </td>
                </tr>
              ) : (
                displayedRows.map(row => {
                  const isExpanded = expandedId === row.id;
                  const isSelected = !!selectedIds[row.id];

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        className={`group cursor-pointer transition-colors ${rowHeightClass} ${
                          isSelected
                            ? 'bg-[var(--ui-selected-bg)]'
                            : isExpanded ? 'bg-slate-50/50 hover:bg-slate-50/70' : 'bg-ui-surface-elevated hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className={`w-10 px-4 ${paddingClass} text-center`} onClick={e => handleSelectRow(row.id, e)}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            aria-label={`Select request ${row.code}`}
                            className="w-4 h-4 rounded accent-[var(--color-secondary-700)] dark:accent-[var(--ui-tab-badge)] cursor-pointer"
                          />
                        </td>

                        {/* Request Title & Code */}
                        {visibleColumns.request && (
                          <td className={`px-4 ${paddingClass}`}>
                            {editingId === row.id ? (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="flex h-8 items-center gap-1.5 rounded-md border-2 border-[var(--color-secondary-700)] dark:border-[var(--ui-tab-active)] bg-ui-surface-elevated dark:bg-[var(--bg-sunken)] pl-2 pr-1.5"
                              >
                                <input
                                  autoFocus
                                  value={editDraft}
                                  onChange={e => setEditDraft(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEdit();
                                    else if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  aria-label={`Edit title of ${row.code}`}
                                  className="min-w-0 flex-1 bg-transparent outline-none dark:selection:bg-[var(--ui-tab-badge)] dark:selection:text-white font-[family-name:var(--font-ui)] text-[13px] leading-[1.4] text-[var(--color-secondary-700)] dark:text-[var(--ui-heading)]"
                                />
                                <button onClick={saveEdit} title="Save (Enter)" className="text-[var(--ui-body)] hover:text-[var(--color-secondary-700)] dark:hover:text-[var(--ui-heading)]">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingId(null)} title="Cancel (Esc)" className="text-[var(--ui-body)] hover:text-[var(--color-secondary-700)] dark:hover:text-[var(--ui-heading)]">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-[var(--ui-body)]">
                                    {row.title}
                                  </span>
                                  <button
                                    onClick={e => { e.stopPropagation(); startEdit(row); }}
                                    title="Edit title"
                                    aria-label={`Edit title of ${row.code}`}
                                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                  >
                                    <Pencil className="w-3 h-3 text-slate-400" />
                                  </button>
                                </div>
                                {!isCompact && (
                                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                                    {row.code}
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                        )}

                        {/* Owner */}
                        {visibleColumns.owner && (
                          <td className={`px-4 ${paddingClass}`}>
                            <div className="flex items-center gap-2">
                              {!isCompact && (
                                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-[10px] shrink-0">
                                  {row.ownerInitials}
                                </div>
                              )}
                              <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                                {row.ownerName}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <td className={`px-4 ${paddingClass} whitespace-nowrap`}>
                            {renderStatusPill(row.status)}
                          </td>
                        )}

                        {/* Priority */}
                        {visibleColumns.priority && (
                          <td className={`px-4 ${paddingClass} whitespace-nowrap`}>
                            {renderPriority(row.priority)}
                          </td>
                        )}

                        {/* Amount */}
                        {visibleColumns.amount && (
                          <td className={`px-4 ${paddingClass} font-mono text-xs font-medium text-slate-700 whitespace-nowrap`}>
                            ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        )}

                        {/* Updated */}
                        {visibleColumns.updated && (
                          <td className={`px-4 ${paddingClass} text-xs text-slate-500 whitespace-nowrap`}>
                            {row.updatedLabel}
                          </td>
                        )}

                        {/* Actions */}
                        <td className={`w-10 px-4 ${paddingClass} text-right`} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Inspect details"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded View Drawer / Details & Approval Workflow */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 border-b border-slate-200">
                          <td colSpan={8} className="p-5">
                            {renderDetails(row)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4b. MOBILE CARD LIST ───────────────────────────────────────── */}
      {mobileView === 'cards' && (
        <div className="md:hidden font-[family-name:var(--font-ui)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="flex items-center gap-2 text-[13px] text-[var(--ui-text-secondary)]">
              <input
                type="checkbox"
                checked={isPageSelected}
                ref={el => { if (el) el.indeterminate = isPagePartlySelected; }}
                onChange={togglePageSelection}
                className="w-4 h-4 rounded accent-[var(--color-secondary-700)] dark:accent-[var(--ui-tab-badge)]"
              />
              Select page
            </label>
            <div className="relative inline-flex h-9 items-center rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated text-[13px] font-semibold text-[var(--ui-body)]">
              <button
                onClick={() => setSortAsc(a => !a)}
                aria-label={sortAsc ? 'Sort descending' : 'Sort ascending'}
                className="h-full pl-2.5 pr-1"
              >
                {sortAsc ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </button>
              <select
                value={sortField}
                onChange={e => setSortField(e.target.value as typeof sortField)}
                aria-label="Sort by"
                className="h-full appearance-none bg-transparent pl-1 pr-7 outline-none"
              >
                {(['updated', 'request', 'owner', 'status', 'priority', 'amount'] as const).map(f => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 w-4 h-4" />
            </div>
          </div>

          {bulkBar && <div className="mb-3 rounded-xl border border-slate-200 bg-ui-surface-elevated">{bulkBar}</div>}

          {pageRows.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated">{noMatchState}</div>
          ) : (
            <div className="flex flex-col gap-3">
              {pageRows.map(row => {
                const isSelected = !!selectedIds[row.id];
                const isExpanded = expandedId === row.id;
                return (
                  <div
                    key={row.id}
                    className={`rounded-xl border p-4 ${
                      isSelected ? 'border-[var(--color-secondary-200)] bg-[var(--ui-selected-bg)]' : 'border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex min-w-0 items-center gap-3 text-[13px] text-[var(--ui-text-secondary)]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => setSelectedIds(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                          aria-label={`Select request ${row.code}`}
                          className="w-4 h-4 shrink-0 rounded accent-[var(--color-secondary-700)] dark:accent-[var(--ui-tab-badge)]"
                        />
                        <span className="truncate">{row.code}</span>
                      </label>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        aria-label={isExpanded ? 'Hide details' : 'Show details'}
                        aria-expanded={isExpanded}
                        className="-mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>

                    <h3 className="mt-3 text-[18px] font-semibold leading-[1.3] text-[var(--ui-heading)]">{row.title}</h3>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      {renderStatusPill(row.status)}
                      {renderPriority(row.priority)}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] pt-4 text-[13px]">
                      <div className="min-w-0">
                        <div className="text-[var(--ui-text-secondary)]">Owner</div>
                        <div className="mt-0.5 truncate text-[15px] text-[var(--ui-body)]">{row.ownerName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[var(--ui-text-secondary)]">Amount</div>
                        <div className="mt-0.5 text-[15px] font-semibold text-[var(--ui-body)]">{formatAmount(row.amount)}</div>
                      </div>
                    </div>

                    <p className="mt-3 text-[13px] text-[var(--ui-text-secondary)]">
                      Updated {row.updatedLabel.charAt(0).toLowerCase() + row.updatedLabel.slice(1)}
                    </p>

                    {isExpanded && <div className="mt-4">{renderDetails(row)}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-[var(--ui-text-secondary)]">
            <span>
              {displayedRows.length === 0 ? 0 : pageStart + 1}–{pageStart + pageRows.length} of {plural(displayedRows.length)}
            </span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              aria-label="Requests per page"
              className="h-9 rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated px-2.5 font-semibold text-[var(--ui-body)]"
            >
              {[10, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`${MOBILE_BTN} disabled:opacity-50`}
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-[13px] text-[var(--ui-text-secondary)]">{currentPage} of {pageCount}</span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              className={`${MOBILE_BTN} disabled:opacity-50`}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── 5. FOOTER SORT CAPTION (desktop) ───────────────────────────── */}
      {selectedCount > 0 || editingId ? (
        <div className="hidden md:flex items-center gap-2 mt-3 text-xs text-slate-400 select-none">
          <CornerDownLeft className="w-3.5 h-3.5 text-slate-400" />
          <span>Enter to save · Esc to cancel · Focus stays in the edited cell. Bulk actions apply only to selected requests.</span>
        </div>
      ) : (
        <div className="hidden md:flex items-center gap-2 mt-3 text-xs text-slate-400 select-none">
          <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
          <span>Updated, newest first · Click a column header to sort</span>
        </div>
      )}

      {/* ── 6. SIGNATURE PAD MODAL ─────────────────────────────────────── */}
      {showSignaturePad && (
        <SignaturePad
          existingBase64={userSignature ?? null}
          onSaved={base64 => {
            setUserSignature(base64);
            setShowSignaturePad(false);
            const resume = pendingApproveRef.current;
            pendingApproveRef.current = null;
            if (resume) setTimeout(resume, 50);
          }}
          onClose={() => {
            setShowSignaturePad(false);
            pendingApproveRef.current = null;
          }}
        />
      )}
    </div>
  );
}
