'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Users, User, Building2, AlertTriangle, Trash2, ChevronLeft, ChevronRight, ChevronDown, Loader2, ArrowUp, ArrowDown, Ban, Filter, Download, Copy, Send, FolderInput, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SOURCE_LABEL } from '@/lib/marketing/classification';
import { REGIONS } from '@/lib/regions';
import { feedback } from '@/components/ui/feedback-toast';

// Local to this filter only — REGIONS.label ("T-Lines North East") is the shared,
// company-wide label used across Sales/Projects/PM too; Marketing asked for the short
// ClickUp-matching form here specifically, not a global rename.
const REGION_FILTER_LABEL: Record<string, string> = {
  TLINES_NE: 'TLINES NE', TLINES_SE: 'TLINES SE', TLINES_NW: 'TLINES NW', CVW: 'TLINES WEST',
};
import { hashColor, readableTextColor } from '@/lib/marketing/pillColor';
import type { ProspectStatus, ProjectType, ScopeType, LeadTiming, LeadEntityType } from '@/types/database';
import { MarketingPipelineNav } from './MarketingPipelineNav';
import { ProspectQuickView } from './ProspectQuickView';
import { SourceSelect } from './SourceSelect';
import { TagMultiSelect } from './TagMultiSelect';
import { Select } from '@/components/platform/shared/Select';
import { exportContactsWorkbook, type ContactExportRow } from '@/lib/excel/contactsExcelExport';

export interface ProspectRow {
  id: string;
  entity_type: LeadEntityType;
  display_name: string;
  organization_name: string | null;
  person_name: string | null;
  brand_name: string | null;
  industry: string | null;
  status: ProspectStatus;
  location_count: number | null;
  source_label: string | null;
  source_raw_label?: string | null;
  business_types?: string[] | null;
  tags?: { name: string; color: string }[] | null;
  region?: string | null;
  project_types: ProjectType[];
  scope_types: ScopeType[];
  timing: LeadTiming | null;
  next_action: string | null;
  next_action_date: string | null;
  target_contact_date: string | null;
  owner_id: string | null;
  assigned_marketing_user_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  external_created_at?: string | null;
  effective_created_at?: string | null;
  primary_contact: string | null;
  primary_contact_id: string | null;
  location_count_actual: number;
  potential_count: number;
  opportunity_count: number;
  owner_name: string | null;
  state: string | null;
  whatsapp: boolean;
  completeness_percent: number;
  other_contacts: { id: string; name: string; whatsapp: boolean; completeness_percent: number }[];
}

interface Props {
  initialProspects: ProspectRow[];
  initialTotal: number;
  pageSize: number;
  canEdit?: boolean;
  /** Everyone who may edit Contacts may import Excel files (merging is still limited to Contacts they may edit). */
  canImport?: boolean;
  loadError?: boolean;
  potentialTotal: number | null;
  opportunityTotal: number | null;
  assignees: { id: string; full_name: string }[];
  // 2026-09-23: every role — the page opens empty and stays empty until at least one filter
  // below is set; app/api/marketing/prospects/route.ts enforces the same rule server-side
  // regardless of what this prop says, so it can't be bypassed by tampering with the client.
  queryRequired?: boolean;
  campaigns: { id: string; name: string }[];
}

function EntityIcon({ type }: { type: LeadEntityType }) {
  const isOrg = type === 'organization';
  const Icon = isOrg ? Building2 : User;
  return (
    <Icon size={14} style={{ color: isOrg ? 'var(--brand-teal-600)' : 'var(--brand-orange-600)', flexShrink: 0 }} />
  );
}

// A clickable named-query button (2026-09-23) — toggles a criterion on/off, distinct in look
// from the plain filter <Select>s below it: filled when active, outlined when not.
function QueryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-[6px] border px-3 text-[12px] font-semibold',
        active
          ? 'border-[var(--color-secondary-700)] bg-[var(--color-secondary-700)] text-white dark:border-ui-heading dark:bg-ui-heading dark:text-primary-950'
          : 'border-ui-input-border bg-ui-input-bg text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:text-ui-heading',
      )}
    >
      {label}
    </button>
  );
}

// Figma Contacts (TASK 52) styling, shared by the toolbar and table below.
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const OUTLINE_BTN = 'inline-flex h-10 items-center justify-center gap-3 rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent px-4 text-[13px] font-semibold text-[var(--color-secondary-700)] no-underline hover:bg-ui-hover-bg disabled:opacity-50 dark:border-ui-heading dark:text-ui-heading [&_svg]:size-4';
const PRIMARY_BTN = 'inline-flex h-10 items-center justify-center gap-3 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-6 text-[13px] font-semibold text-white no-underline hover:bg-[var(--color-secondary-700)]/90 disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950 dark:hover:bg-primary-100 [&_svg]:size-4';
const FILTER_STYLE: React.CSSProperties = {
  height: 40, fontSize: 12, borderRadius: 4, border: '1px solid var(--color-secondary-700)', background: 'var(--ui-input-bg)',
};
const TH_CLS = 'h-[46px] whitespace-nowrap px-2.5 text-[12px] font-semibold leading-[1.4] text-ui-body first:pl-[18px]';
const TD_CLS = 'px-2.5 py-2 text-[13px] text-ui-body first:pl-[18px]';
// Shared with the Potentials tab (OpportunitiesPageClient) so both tabs read the same.
const SUB_TD_CLS = 'px-2.5 py-2 text-[12px] text-ui-text-secondary';
const PAGE_BTN = 'inline-flex h-[34px] items-center justify-center gap-1 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-[14px] text-[13px] font-semibold text-[var(--color-secondary-700)] disabled:opacity-50 dark:text-ui-heading [&_svg]:size-3.5';
const DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
// UTC: target_contact_date is a DATE column — in a US time zone it would otherwise show a day early.
const DATE_ONLY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function NotAssignedChip() {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium"
      style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}
    >
      <Ban size={14} aria-hidden /> Not Assigned
    </span>
  );
}

function CompletenessBar({ percent }: { percent: number }) {
  const tone = percent >= 80 ? 't6' : percent >= 40 ? 't7' : 't10';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-[5px] w-[60px] overflow-hidden rounded-[3px] bg-ui-surface">
        <div className="h-full" style={{ width: `${percent}%`, background: `var(--status-${tone}-fg)` }} />
      </div>
      <span className="text-[11px] text-ui-text-secondary">{percent}%</span>
    </div>
  );
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function OwnerAvatar({ name }: { name: string | null }) {
  return (
    <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold leading-[1.4] text-ui-body">
      {name ? initials(name) : '—'}
    </span>
  );
}

function TagPill({ label, bg }: { label: string; bg: string }) {
  return (
    <span style={{ background: bg, color: readableTextColor(bg), fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function ProspectsPageClient({ initialProspects, initialTotal, pageSize, canEdit, canImport, loadError, potentialTotal, opportunityTotal, assignees, queryRequired, campaigns }: Props) {
  const [prospects, setProspects] = useState<ProspectRow[]>(initialProspects);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  // Seeded from ?status=... on first load — used by the /marketing/opportunities redirect to
  // land marketing_pr directly on their Potentials queue instead of an empty unfiltered list.
  const [statusFilter, setStatusFilter] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('status') ?? '' : ''));
  const [regionFilter, setRegionFilter] = useState('');
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [completenessFilter, setCompletenessFilter] = useState('');
  // Query-builder-only filters (2026-09-23) — "who attended this campaign/event", "who came in
  // through a survey", "who currently has / had / never had a project".
  const [campaignFilter, setCampaignFilter] = useState('');
  const [surveyOnlyFilter, setSurveyOnlyFilter] = useState(false);
  const [followUpOverdueFilter, setFollowUpOverdueFilter] = useState(false);
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const SERVER_SORT_KEYS = new Set(['created_at', 'source']);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<string[]>([]);
  const isFirstRender = useRef(true);

  useEffect(() => {
    fetch('/api/marketing/prospects/source-options').then(r => r.json()).then(b => setSourceOptions(b.options ?? [])).catch(() => {});
    fetch('/api/marketing/prospects/business-type-options').then(r => r.json()).then(b => setBusinessTypeOptions(b.options ?? [])).catch(() => {});
    fetch('/api/marketing/mail-templates').then(r => r.json()).then(b => setTemplates(b.templates ?? [])).catch(() => {});
  }, []);

  async function updateSource(p: ProspectRow, next: string) {
    const value = next.trim() || null;
    setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, source_raw_label: value } : x)));
    const res = await fetch(`/api/marketing/prospects/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_raw_label: value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not update source');
      setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, source_raw_label: p.source_raw_label } : x)));
      return;
    }
    if (value && !sourceOptions.includes(value)) setSourceOptions(prev => [...prev, value].sort());
  }

  async function updateAssignee(p: ProspectRow, next: string) {
    const value = next || null;
    const nextName = assignees.find(a => a.id === value)?.full_name ?? null;
    setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, assigned_marketing_user_id: value, owner_name: nextName } : x)));
    const res = await fetch(`/api/marketing/prospects/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_marketing_user_id: value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not update assignee');
      setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, assigned_marketing_user_id: p.assigned_marketing_user_id, owner_name: p.owner_name } : x)));
    }
  }

  async function updateBusinessTypes(p: ProspectRow, next: string[]) {
    setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, business_types: next } : x)));
    const res = await fetch(`/api/marketing/prospects/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business_types: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not update business type');
      setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, business_types: p.business_types } : x)));
      return;
    }
    const newOnes = next.filter(v => !businessTypeOptions.includes(v));
    if (newOnes.length) setBusinessTypeOptions(prev => [...prev, ...newOnes].sort());
  }

  async function toggleWhatsapp(p: ProspectRow) {
    if (!p.primary_contact_id) return;
    const next = !p.whatsapp;
    setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, whatsapp: next } : x)));
    const res = await fetch(`/api/marketing/prospects/${p.id}/contacts/${p.primary_contact_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not update WhatsApp');
      setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, whatsapp: p.whatsapp } : x)));
    }
  }

  async function toggleContactWhatsapp(p: ProspectRow, contactId: string, current: boolean) {
    const next = !current;
    setProspects(prev => prev.map(x => (x.id === p.id
      ? { ...x, other_contacts: x.other_contacts.map(c => (c.id === contactId ? { ...c, whatsapp: next } : c)) }
      : x)));
    const res = await fetch(`/api/marketing/prospects/${p.id}/contacts/${contactId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not update WhatsApp');
      setProspects(prev => prev.map(x => (x.id === p.id
        ? { ...x, other_contacts: x.other_contacts.map(c => (c.id === contactId ? { ...c, whatsapp: current } : c)) }
        : x)));
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const hasAnyQuery = !!(query.trim() || statusFilter || regionFilter || sourceFilters.length > 0 || completenessFilter || campaignFilter || surveyOnlyFilter || projectStatusFilter || followUpOverdueFilter);

  function buildParams(extra: Record<string, string>) {
    const params = new URLSearchParams(extra);
    if (query.trim()) params.set('q', query.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (regionFilter) params.set('region', regionFilter);
    sourceFilters.forEach(s => params.append('source', s));
    if (completenessFilter) params.set('completeness', completenessFilter);
    if (campaignFilter) params.set('campaignId', campaignFilter);
    if (surveyOnlyFilter) params.set('surveyOnly', '1');
    if (projectStatusFilter) params.set('projectStatus', projectStatusFilter);
    if (followUpOverdueFilter) params.set('followUp', 'overdue');
    return params;
  }

  async function load(nextPage: number) {
    // queryRequired accounts get nothing until they set at least one filter — never even asks
    // the server for an unfiltered page (the API would refuse it anyway, this just skips the
    // round trip and keeps the empty/prompt state showing instead of a flash of "0 results").
    if (queryRequired && !hasAnyQuery) { setProspects([]); setTotal(0); setPage(1); return; }
    setLoading(true);
    try {
      const params = buildParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (sortKey && SERVER_SORT_KEYS.has(sortKey)) { params.set('sort', sortKey); params.set('dir', sortDir); }
      const res = await fetch(`/api/marketing/prospects?${params.toString()}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) { toast.error(body?.error ?? 'Could not load leads'); return; }
      setProspects(body.prospects ?? []);
      setTotal(body.total ?? 0);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  async function exportContacts(mode: 'excel' | 'copy' | 'merge-csv') {
    if (!hasAnyQuery) { toast.error('Set at least one filter first.'); return; }
    setExporting(true);
    try {
      if (mode === 'excel') {
        // Every field the card has, project name/number included — same exporter and API mode
        // Contact Manager's "Export to Excel" uses (2026-09-28).
        const params = buildParams({ export: '1', detail: '1' });
        const res = await fetch(`/api/marketing/prospects?${params.toString()}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) { toast.error(body?.error ?? 'Could not export contacts'); return; }
        const contacts = (body.contacts ?? []) as ContactExportRow[];
        if (contacts.length === 0) { toast.error('Nothing to export.'); return; }
        const done = await exportContactsWorkbook(contacts, undefined, { onProgress: m => toast.loading(m, { id: 'excel-export' }) });
        toast.dismiss('excel-export');
        toast.success(`Exported ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}${done.photos ? ` with ${done.photos} photo${done.photos === 1 ? '' : 's'}` : ''}.`);
        if (done.photos < done.photosWanted) toast.message(`${done.photosWanted - done.photos} photo(s) could not be added to the Excel.`);
        return;
      }

      const params = buildParams({ export: '1' });
      if (mode === 'merge-csv' && templateId) params.set('templateId', templateId);
      const res = await fetch(`/api/marketing/prospects?${params.toString()}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) { toast.error(body?.error ?? 'Could not export contacts'); return; }
      const contacts = (body.contacts ?? []) as { name: string; email: string; subject?: string; body?: string }[];
      if (contacts.length === 0) { toast.error('No matching contacts have an email on file.'); return; }
      if (mode === 'copy') {
        await navigator.clipboard.writeText(contacts.map(c => c.email).join(', '));
        toast.success(`Copied ${contacts.length} email${contacts.length !== 1 ? 's' : ''} to clipboard.`);
      } else {
        const merged = 'subject' in contacts[0];
        const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
        const csv = [
          merged ? 'Name,Email,Subject,Body' : 'Name,Email',
          ...contacts.map(c => (merged ? [c.name, c.email, c.subject ?? '', c.body ?? ''] : [c.name, c.email]).map(esc).join(',')),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `contacts-mail-merge-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}.`);
      }
    } finally {
      setExporting(false);
    }
  }

  async function sendWithTemplate() {
    if (!templateId) { toast.error('Pick a template first.'); return; }
    if (!hasAnyQuery) { toast.error('Set at least one filter first.'); return; }
    const templateName = templates.find(t => t.id === templateId)?.name ?? 'this template';
    if (!confirm(`Send "${templateName}" to ${total} matching contact${total !== 1 ? 's' : ''}? This can't be undone.`)) return;

    setSending(true);
    try {
      const filters = {
        q: query.trim() || undefined, status: statusFilter || undefined, region: regionFilter || undefined,
        sources: sourceFilters.length > 0 ? sourceFilters : undefined, completeness: completenessFilter || undefined,
        campaignId: campaignFilter || undefined, surveyOnly: surveyOnlyFilter || undefined,
        projectStatus: projectStatusFilter || undefined,
        followUpOverdue: followUpOverdueFilter || undefined,
      };
      const res = await fetch('/api/marketing/prospects/bulk-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, filters }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not send'); return; }
      // Queued as an email campaign: the first batch is out, the rest follow every 10 minutes.
      toast.success(
        body.done
          ? `Sent to ${body.sent} contact${body.sent !== 1 ? 's' : ''}${body.failed ? ` — ${body.failed} failed` : ''}.`
          : `Sending to ${body.queued} contacts from your mailbox — ${body.sent} sent so far, the rest follow automatically.`,
        { action: { label: 'Open report', onClick: () => window.location.assign(`/marketing/email/${body.campaignId}`) } },
      );
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // initialProspects (server-rendered) is always the unfiltered list — if ?status=...
      // seeded a non-empty statusFilter (e.g. the /marketing/opportunities → Lead Cloud
      // redirect for marketing_pr), refetch immediately so the visible rows actually match it.
      if (statusFilter) load(1);
      return;
    }
    const t = setTimeout(() => { load(1); }, 300);
    return () => clearTimeout(t);

  }, [query, statusFilter, regionFilter, sourceFilters, completenessFilter, campaignFilter, surveyOnlyFilter, projectStatusFilter, followUpOverdueFilter, sortKey && SERVER_SORT_KEYS.has(sortKey) ? sortKey : null, sortKey && SERVER_SORT_KEYS.has(sortKey) ? sortDir : null]);

  function toggleSort(key: string) {
    if (sortKey === key) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return; }
    setSortKey(key);
    setSortDir('desc');
  }

  // Same as the Potentials tab: only the active sort column shows an arrow.
  function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
    if (!active) return null;
    return dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />;
  }

  function SortableTh({ label, sortKeyName }: { label: string; sortKeyName: string }) {
    return (
      <th className={TH_CLS} aria-sort={sortKey === sortKeyName ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
        <button
          type="button"
          title={`Sort by ${label}`}
          onClick={() => toggleSort(sortKeyName)}
          className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-[inherit] text-[inherit]"
        >
          {label}
          <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
        </button>
      </th>
    );
  }

  const displayProspects = useMemo(() => {
    if (!sortKey || SERVER_SORT_KEYS.has(sortKey)) return prospects;
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...prospects];
    sorted.sort((a, b) => {
      if (sortKey === 'state') return (a.state ?? '').localeCompare(b.state ?? '') * dir;
      if (sortKey === 'business_type') return (a.business_types?.[0] ?? '').localeCompare(b.business_types?.[0] ?? '') * dir;
      if (sortKey === 'information') return (a.completeness_percent - b.completeness_percent) * dir;
      if (sortKey === 'whatsapp') return (Number(a.whatsapp) - Number(b.whatsapp)) * dir;
      return 0;
    });
    return sorted;
  }, [prospects, sortKey, sortDir]);

  async function trashProspect(e: React.MouseEvent, p: ProspectRow) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${p.display_name}"? It stays in the database (recoverable), but disappears everywhere in the UI.`)) return;
    const res = await fetch(`/api/marketing/prospects/${p.id}/trash`, { method: 'POST' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not delete'); return; }
    setProspects(prev => prev.filter(x => x.id !== p.id));
    setTotal(t => Math.max(0, t - 1));
    feedback.info('Lead moved to Trash', {
      description: `${p.display_name} and its needs and opportunities can be restored.`,
      action: { label: 'Undo move', onClick: () => void restoreProspect(p) },
    });
  }

  async function restoreProspect(p: ProspectRow) {
    const res = await fetch(`/api/marketing/prospects/${p.id}/restore`, { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) {
      feedback.error('Could not restore', {
        description: `${p.display_name} is still in Trash.`,
        action: { label: 'Try again', onClick: () => void restoreProspect(p) },
      });
      return;
    }
    setProspects(prev => (prev.some(x => x.id === p.id) ? prev : [p, ...prev]));
    setTotal(t => t + 1);
    feedback.success('Lead restored', { description: p.display_name });
  }

  if (loadError) {
    return (
      <div className="rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-12 text-center text-[13px] text-ui-text-secondary">
        <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: 'var(--status-t7-fg)' }} />
        <div>Contacts isn&apos;t ready yet. Migrations 072/073 need to be applied.</div>
      </div>
    );
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = hasAnyQuery;
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Marketing', href: '/marketing' }, { label: 'Contacts', href: '/marketing/prospects' }]} />
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>Contacts</h1>
          <p className="m-0 text-[13px] text-ui-body">
            {queryRequired && !hasAnyQuery
              ? 'Build a query below to see a list — the full Contacts table isn’t browsable here.'
              : `${total.toLocaleString('en-US')} contact${total !== 1 ? 's' : ''} — Marketing-owned`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canImport && (
            <Link href="/marketing/import" className={OUTLINE_BTN} title="Add contacts from any Excel / CSV file, with duplicate checking">
              <Upload /> Import from Excel
            </Link>
          )}
          {canEdit && (
            <Link href="/marketing/prospects/new" className={PRIMARY_BTN} title="Not a confirmed deal yet — no project is created until evidence is attached or Sales accepts">
              + Capture New Contact
            </Link>
          )}
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <MarketingPipelineNav
          current="prospects"
          prospectCount={total} potentialCount={potentialTotal} opportunityCount={opportunityTotal}
        />
      </div>

      {/* Quick queries — press a button to run a named query for the fixed, small set of
          criteria (2026-09-23, "butonlu olsun"). Campaigns/events are NOT in that row — there
          are 50+ real ones (2026-09-28), a row of that many buttons was the opposite of easy
          to use, so that one stayed a searchable Select instead. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="text-[12px] font-medium text-ui-body">Quick queries</span>
        {campaigns.length > 0 && (
          <Select
            className="form-input" style={{ ...FILTER_STYLE, height: 32, maxWidth: 220 }}
            value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)} aria-label="Filter by campaign/event"
          >
            <option value="">Campaign / event…</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
        <QueryPill label="From a survey" active={surveyOnlyFilter} onClick={() => setSurveyOnlyFilter(v => !v)} />
        <QueryPill label="Follow-up overdue" active={followUpOverdueFilter} onClick={() => setFollowUpOverdueFilter(v => !v)} />
        <QueryPill
          label="Has an active project" active={projectStatusFilter === 'active'}
          onClick={() => setProjectStatusFilter(prev => (prev === 'active' ? '' : 'active'))}
        />
        <QueryPill
          label="Project finished" active={projectStatusFilter === 'finished'}
          onClick={() => setProjectStatusFilter(prev => (prev === 'finished' ? '' : 'finished'))}
        />
        <QueryPill
          label="Never had a project" active={projectStatusFilter === 'none'}
          onClick={() => setProjectStatusFilter(prev => (prev === 'none' ? '' : 'none'))}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px', maxWidth: 380 }}>
          <Search size={16} className="text-ui-text-secondary" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="form-input"
            style={{ height: 40, paddingLeft: 34, fontSize: 13, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)' }}
            placeholder="Search contacts…" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search Contacts"
          />
        </div>
        <Select className="form-input" style={{ ...FILTER_STYLE, maxWidth: 170 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All classifications</option>
          <option value="captured">No project yet</option>
          <option value="potential">Potential</option>
          <option value="opportunity_candidate">Opportunity Candidate</option>
          <option value="disqualified">Disqualified</option>
        </Select>
        <Select className="form-input" style={{ ...FILTER_STYLE, maxWidth: 170 }} value={regionFilter} onChange={e => setRegionFilter(e.target.value)} aria-label="Filter by region">
          <option value="">All regions</option>
          {REGIONS.map(r => <option key={r.code} value={r.code}>{REGION_FILTER_LABEL[r.code] ?? r.label}</option>)}
        </Select>
        {/* Real, per-record source labels (e.g. "HRA 2026") — the same list the per-row source
            editor below offers, not the fixed classification enum most rows never set at all.
            Filtering against the wrong one made custom labels un-findable (2026-09-28 fix).
            Multi-select (2026-09-28, "birden fazla source seçebilsin") — same TagMultiSelect
            the per-row Business Type editor already uses, so picking several sources OR's them
            together instead of being stuck with just one. */}
        <div
          style={{
            ...FILTER_STYLE, height: 'auto', minHeight: 40, display: 'flex', alignItems: 'center',
            minWidth: 160, maxWidth: 320, padding: '5px 11px',
          }}
        >
          <TagMultiSelect values={sourceFilters} options={sourceOptions} onChange={setSourceFilters} placeholder="All sources" />
        </div>
        {/* "Missing info" isn't a DB column — completeness_percent is computed per-row
            (lib/marketing/prospectCompleteness.ts) from contact/location/source fields — the
            API filters on it after enrichment rather than in SQL, see app/api/marketing/
            prospects/route.ts's `completeness === 'missing'` branch. */}
        <Select className="form-input" style={{ ...FILTER_STYLE, maxWidth: 170 }} value={completenessFilter} onChange={e => setCompletenessFilter(e.target.value)} aria-label="Filter by info completeness">
          <option value="">All info levels</option>
          <option value="missing">Missing info</option>
        </Select>
        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQuery(''); setStatusFilter(''); setRegionFilter(''); setSourceFilters([]); setCompletenessFilter('');
              setCampaignFilter(''); setSurveyOnlyFilter(false); setProjectStatusFilter(''); setFollowUpOverdueFilter(false);
            }}
          >
            Clear filters
          </button>
        )}
        {loading && <Loader2 size={15} style={{ color: 'var(--fg-subtle)', animation: 'spin 1s linear infinite' }} />}
        <span style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
          {hasFilters && total > 0 && (
            <>
              {templates.length > 0 && (
                <Select
                  className="form-input"
                  style={{ ...FILTER_STYLE, maxWidth: 200, height: 40, borderRadius: 6, fontSize: 13, fontWeight: 600 }}
                  value={templateId} onChange={e => setTemplateId(e.target.value)} aria-label="Mail template"
                  title="Pick a template to merge into the CSV or to send"
                >
                  <option value="">Template Picker</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              )}
              <button className={OUTLINE_BTN} disabled={exporting} onClick={() => exportContacts('copy')} title="Copy every matching contact's email, comma-separated">
                <Copy /> Copy emails
              </button>
              {templateId && (
                <button
                  className={OUTLINE_BTN} disabled={exporting}
                  onClick={() => exportContacts('merge-csv')}
                  title="Download name, email, subject and merged body for every matching contact — for a mail-merge tool"
                >
                  <Download /> Download merge CSV
                </button>
              )}
              {templateId && (
                <button className={OUTLINE_BTN} disabled={sending} onClick={sendWithTemplate} title="Send this template to every matching contact">
                  <Send /> {sending ? 'Sending…' : `Send to ${total}`}
                </button>
              )}
              <button
                className={PRIMARY_BTN} disabled={exporting}
                onClick={() => exportContacts('excel')}
                title="Download every field for every matching contact as a formatted Excel file"
              >
                <FolderInput /> Export File
              </button>
            </>
          )}
          <Link
            href="/marketing/prospects/trash"
            aria-label="Trash"
            title="Deleted contacts (Trash)"
            className="inline-flex size-10 items-center justify-center rounded-[6px] hover:brightness-95 [&_svg]:size-4"
            style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
          >
            <Trash2 aria-hidden />
          </Link>
        </span>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[6px] border border-ui-divider bg-ui-page-bg px-6 py-12 text-center text-[13px] text-ui-text-secondary">
          {queryRequired && !hasAnyQuery ? (
            <>
              <Filter size={28} className="opacity-40" aria-hidden />
              <div>Pick a campaign, survey, project status, or search above to pull a contact list.</div>
            </>
          ) : (
            <>
              <Users size={28} className="opacity-40" aria-hidden />
              <div>
                {hasFilters ? 'No contacts match your filters.' : <>No contacts yet.{canEdit && ' Click "Capture New Contact" to add the first one.'}</>}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[6px] border border-ui-divider bg-ui-page-bg">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr className="border-b border-ui-divider bg-ui-surface text-left">
                  <th className={TH_CLS}>Name</th>
                  <SortableTh label="01 - State" sortKeyName="state" />
                  <SortableTh label="13 - Source" sortKeyName="source" />
                  <SortableTh label="08 - Business Type" sortKeyName="business_type" />
                  <th className={TH_CLS}>Assignee</th>
                  <th className={TH_CLS}>Due date</th>
                  <SortableTh label="Date created" sortKeyName="created_at" />
                  <SortableTh label="Information" sortKeyName="information" />
                  <SortableTh label="Whatsapp" sortKeyName="whatsapp" />
                  {canEdit && <th className={TH_CLS}><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody style={{ opacity: loading ? 0.5 : 1 }}>
                {displayProspects.map(p => {
                  const source = p.source_raw_label || (p.source_label ? (SOURCE_LABEL[p.source_label as keyof typeof SOURCE_LABEL] ?? p.source_label) : null);
                  const assigneeName = canEdit ? (assignees.find(a => a.id === p.assigned_marketing_user_id)?.full_name ?? null) : p.owner_name;
                  return (
                  <Fragment key={p.id}>
                  <tr
                    onClick={() => setQuickViewId(p.id)}
                    className="h-16 cursor-pointer border-t border-ui-divider hover:bg-ui-surface"
                  >
                    <td className={TD_CLS}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Companies always expand to their contact person(s), like ClickUp's
                            Company → Person rows — even with just one, the primary contact's
                            name is otherwise never shown anywhere on the collapsed row. */}
                        {(p.entity_type === 'organization' ? !!p.primary_contact || p.other_contacts.length > 0 : p.other_contacts.length > 0) ? (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); toggleExpand(p.id); }}
                            className="flex cursor-pointer border-0 bg-transparent p-0 text-ui-text-secondary transition-transform"
                            style={{ transform: expandedIds.has(p.id) ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                            aria-label={expandedIds.has(p.id) ? 'Collapse' : 'Expand'}
                            aria-expanded={expandedIds.has(p.id)}
                          >
                            <ChevronDown size={13} />
                          </button>
                        ) : <span style={{ width: 13 }} />}
                        <EntityIcon type={p.entity_type} />
                        <span className={cn('text-[12px] font-medium', HEADING_TEXT)}>{p.display_name}</span>
                        {p.other_contacts.length > 0 && (
                          <span className="text-[11px] text-ui-text-secondary">+{p.other_contacts.length}</span>
                        )}
                        {(p.tags ?? []).map(t => <TagPill key={t.name} label={t.name} bg={t.color} />)}
                      </div>
                      {p.brand_name && <div className="mt-1 ml-[39px] text-[11px] text-ui-text-secondary">{p.brand_name}</div>}
                    </td>
                    <td className={TD_CLS}>{p.state ?? '—'}</td>
                    <td className={TD_CLS}>
                      {canEdit ? (
                        <SourceSelect value={source} options={sourceOptions} onChange={v => updateSource(p, v)} />
                      ) : (
                        <span>{source ?? '—'}</span>
                      )}
                    </td>
                    <td className={TD_CLS}>
                      {canEdit ? (
                        <TagMultiSelect values={p.business_types ?? []} options={businessTypeOptions} onChange={v => updateBusinessTypes(p, v)} placeholder="Add…" />
                      ) : (p.business_types ?? []).length === 0 ? <span>—</span> : (
                        <div className="flex flex-wrap gap-[3px]">
                          {(p.business_types ?? []).map(bt => <TagPill key={bt} label={bt} bg={hashColor(bt)} />)}
                        </div>
                      )}
                    </td>
                    <td className={TD_CLS} onClick={e => e.stopPropagation()}>
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          {assigneeName && <OwnerAvatar name={assigneeName} />}
                          <Select
                            value={p.assigned_marketing_user_id ?? ''}
                            onChange={e => updateAssignee(p, e.target.value)}
                            aria-label="Assignee"
                            className="max-w-[150px] cursor-pointer rounded-[4px] border border-transparent bg-transparent py-1 pl-1 pr-5 text-[13px] text-ui-body hover:border-ui-input-border"
                          >
                            <option value="">Not Assigned</option>
                            {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                          </Select>
                        </div>
                      ) : assigneeName ? (
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <OwnerAvatar name={assigneeName} />
                          {assigneeName}
                        </span>
                      ) : (
                        <NotAssignedChip />
                      )}
                    </td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>
                      {p.target_contact_date ? (
                        <span style={p.target_contact_date < todayIso ? { color: 'var(--status-t10-fg)' } : undefined}>
                          {DATE_ONLY.format(new Date(p.target_contact_date))}
                        </span>
                      ) : '—'}
                    </td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>
                      {DATE_TIME.format(new Date(p.effective_created_at ?? p.external_created_at ?? p.created_at))}
                    </td>
                    <td className={TD_CLS}>
                      <CompletenessBar percent={p.completeness_percent} />
                    </td>
                    <td className={TD_CLS} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox" checked={p.whatsapp} disabled={!canEdit || !p.primary_contact_id}
                        onChange={() => toggleWhatsapp(p)}
                        aria-label={`WhatsApp for ${p.display_name}`}
                        className="size-4 accent-[var(--color-secondary-700)]"
                        style={{ cursor: canEdit && p.primary_contact_id ? 'pointer' : 'default' }}
                      />
                    </td>
                    {canEdit && (
                      <td className={TD_CLS}>
                        <button
                          type="button"
                          onClick={e => trashProspect(e, p)}
                          title="Delete"
                          aria-label={`Delete ${p.display_name}`}
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[6px] border-0 hover:brightness-95"
                          style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                  {expandedIds.has(p.id) && p.entity_type === 'organization' && p.primary_contact && (
                    <tr className="border-t border-ui-divider bg-ui-surface">
                      <td className="py-2 pl-[41px] pr-2.5">
                        <div className="flex items-center gap-1.5 text-[12px] text-ui-body">
                          <User size={13} className="shrink-0 text-ui-text-secondary" aria-hidden />
                          {p.primary_contact}
                        </div>
                      </td>
                      <td className={SUB_TD_CLS}>{p.state ?? '—'}</td>
                      <td className={SUB_TD_CLS}>{source ?? '—'}</td>
                      <td className={SUB_TD_CLS}>
                        {(p.business_types ?? []).length === 0 ? '—' : (
                          <div className="flex flex-wrap gap-[3px]">
                            {(p.business_types ?? []).map(bt => <TagPill key={bt} label={bt} bg={hashColor(bt)} />)}
                          </div>
                        )}
                      </td>
                      <td />
                      <td />
                      <td />
                      <td className={SUB_TD_CLS}><CompletenessBar percent={p.completeness_percent} /></td>
                      <td className={SUB_TD_CLS}>
                        <input
                          type="checkbox" checked={p.whatsapp} disabled={!canEdit || !p.primary_contact_id}
                          onChange={() => toggleWhatsapp(p)}
                          aria-label={`WhatsApp for ${p.primary_contact}`}
                          className="size-4 accent-[var(--color-secondary-700)]"
                          style={{ cursor: canEdit && p.primary_contact_id ? 'pointer' : 'default' }}
                        />
                      </td>
                      {canEdit && <td />}
                    </tr>
                  )}
                  {expandedIds.has(p.id) && p.other_contacts.map(oc => (
                    <tr key={oc.id} className="border-t border-ui-divider bg-ui-surface">
                      <td className="py-2 pl-[41px] pr-2.5">
                        <div className="flex items-center gap-1.5 text-[12px] text-ui-body">
                          <User size={13} className="shrink-0 text-ui-text-secondary" aria-hidden />
                          {oc.name}
                        </div>
                      </td>
                      <td className={SUB_TD_CLS}>{p.state ?? '—'}</td>
                      <td className={SUB_TD_CLS}>{source ?? '—'}</td>
                      <td className={SUB_TD_CLS}>
                        {(p.business_types ?? []).length === 0 ? '—' : (
                          <div className="flex flex-wrap gap-[3px]">
                            {(p.business_types ?? []).map(bt => <TagPill key={bt} label={bt} bg={hashColor(bt)} />)}
                          </div>
                        )}
                      </td>
                      <td />
                      <td />
                      <td />
                      <td className={SUB_TD_CLS}><CompletenessBar percent={oc.completeness_percent} /></td>
                      <td className={SUB_TD_CLS}>
                        <input
                          type="checkbox" checked={oc.whatsapp} disabled={!canEdit}
                          onChange={() => toggleContactWhatsapp(p, oc.id, oc.whatsapp)}
                          aria-label={`WhatsApp for ${oc.name}`}
                          className="size-4 accent-[var(--color-secondary-700)]"
                          style={{ cursor: canEdit ? 'pointer' : 'default' }}
                        />
                      </td>
                      {canEdit && <td />}
                    </tr>
                  ))}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-ui-text-secondary">
            <span>Showing {from.toLocaleString('en-US')}–{to.toLocaleString('en-US')} of {total.toLocaleString('en-US')} contacts</span>
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
        </>
      )}

      {quickViewId && (
        <ProspectQuickView
          prospectId={quickViewId}
          canEdit={canEdit}
          onClose={() => { setQuickViewId(null); load(page); }}
        />
      )}
    </>
  );
}
