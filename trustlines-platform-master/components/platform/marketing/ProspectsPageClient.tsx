'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Users, User, Building2, AlertTriangle, Trash2, ChevronLeft, ChevronRight, ChevronDown, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Filter, Download, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { SOURCE_LABEL, SOURCES } from '@/lib/marketing/classification';
import { REGIONS } from '@/lib/regions';

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
      style={{
        fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap',
        border: active ? '1px solid var(--brand-teal-600, #0d9488)' : '1px solid var(--border-subtle)',
        background: active ? 'var(--brand-teal-600, #0d9488)' : 'var(--bg-surface)',
        color: active ? '#fff' : 'var(--fg-default)',
        cursor: 'pointer', transition: 'background 120ms, color 120ms, border-color 120ms',
      }}
    >
      {label}
    </button>
  );
}

function TagPill({ label, bg }: { label: string; bg: string }) {
  return (
    <span style={{ background: bg, color: readableTextColor(bg), fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function ProspectsPageClient({ initialProspects, initialTotal, pageSize, canEdit, loadError, potentialTotal, opportunityTotal, assignees, queryRequired, campaigns }: Props) {
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
  const [sourceFilter, setSourceFilter] = useState('');
  const [completenessFilter, setCompletenessFilter] = useState('');
  // Query-builder-only filters (2026-09-23) — "who attended this campaign/event", "who came in
  // through a survey", "who currently has / had / never had a project".
  const [campaignFilter, setCampaignFilter] = useState('');
  const [surveyOnlyFilter, setSurveyOnlyFilter] = useState(false);
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [exporting, setExporting] = useState(false);
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

  const hasAnyQuery = !!(query.trim() || statusFilter || regionFilter || sourceFilter || completenessFilter || campaignFilter || surveyOnlyFilter || projectStatusFilter);

  function buildParams(extra: Record<string, string>) {
    const params = new URLSearchParams(extra);
    if (query.trim()) params.set('q', query.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (regionFilter) params.set('region', regionFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    if (completenessFilter) params.set('completeness', completenessFilter);
    if (campaignFilter) params.set('campaignId', campaignFilter);
    if (surveyOnlyFilter) params.set('surveyOnly', '1');
    if (projectStatusFilter) params.set('projectStatus', projectStatusFilter);
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

  async function exportContacts(mode: 'csv' | 'copy') {
    if (!hasAnyQuery) { toast.error('Set at least one filter first.'); return; }
    setExporting(true);
    try {
      const params = buildParams({ export: '1' });
      const res = await fetch(`/api/marketing/prospects?${params.toString()}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) { toast.error(body?.error ?? 'Could not export contacts'); return; }
      const contacts = (body.contacts ?? []) as { name: string; email: string }[];
      if (contacts.length === 0) { toast.error('No matching contacts have an email on file.'); return; }
      if (mode === 'copy') {
        await navigator.clipboard.writeText(contacts.map(c => c.email).join(', '));
        toast.success(`Copied ${contacts.length} email${contacts.length !== 1 ? 's' : ''} to clipboard.`);
      } else {
        const csv = ['Name,Email', ...contacts.map(c => `"${c.name.replace(/"/g, '""')}","${c.email}"`)].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}.`);
      }
    } finally {
      setExporting(false);
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

  }, [query, statusFilter, regionFilter, sourceFilter, completenessFilter, campaignFilter, surveyOnlyFilter, projectStatusFilter, sortKey && SERVER_SORT_KEYS.has(sortKey) ? sortKey : null, sortKey && SERVER_SORT_KEYS.has(sortKey) ? sortDir : null]);

  function toggleSort(key: string) {
    if (sortKey === key) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return; }
    setSortKey(key);
    setSortDir('desc');
  }

  function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
    if (!active) return <ArrowUpDown size={11} style={{ opacity: 0.35 }} />;
    return dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  }

  function SortableTh({ label, sortKeyName }: { label: string; sortKeyName: string }) {
    return (
      <th style={{ padding: '10px 12px', fontWeight: 600 }}>
        <button
          onClick={() => toggleSort(sortKeyName)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', padding: 0, textTransform: 'inherit', letterSpacing: 'inherit' }}
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
    toast.success('Deleted');
  }

  if (loadError) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        <AlertTriangle size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <div>Contacts isn&apos;t ready yet. Migrations 072/073 need to be applied.</div>
      </div></div>
    );
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = hasAnyQuery;
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <MarketingPipelineNav
        current="prospects"
        prospectCount={total} potentialCount={potentialTotal} opportunityCount={opportunityTotal}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Contacts</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {queryRequired && !hasAnyQuery
              ? 'Build a query below to see a list — the full Contacts table isn’t browsable here.'
              : `${total.toLocaleString('en-US')} contact${total !== 1 ? 's' : ''} — Marketing-owned`}
          </p>
        </div>
        {canEdit && (
          <Link href="/marketing/prospects/new" className="btn btn-primary" title="Not a confirmed deal yet — no project is created until evidence is attached or Sales accepts">
            + Capture New Contact
          </Link>
        )}
      </div>

      {/* Quick queries (2026-09-23, "butonlu olsun, sorgu/filtre gibi olmasın") — press a
          button to run a named query, not fill in a dropdown. Each toggles on/off; a campaign
          button and a project-status button combine (e.g. "Natso 2026" + "Never had a
          project" = attendees Sales hasn't converted yet), same as before, just not a Select. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-subtle)' }}>
          Quick queries
        </span>
        {campaigns.map(c => (
          <QueryPill
            key={c.id} label={c.name} active={campaignFilter === c.id}
            onClick={() => setCampaignFilter(prev => (prev === c.id ? '' : c.id))}
          />
        ))}
        <QueryPill label="From a survey" active={surveyOnlyFilter} onClick={() => setSurveyOnlyFilter(v => !v)} />
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px', maxWidth: 360 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)' }} />
          <input
            className="form-input" style={{ paddingLeft: 32, fontSize: 13 }}
            placeholder="Search Contacts…" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search Contacts"
          />
        </div>
        <Select className="form-input" style={{ maxWidth: 170, fontSize: 13 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All classifications</option>
          <option value="captured">No project yet</option>
          <option value="potential">Potential</option>
          <option value="opportunity_candidate">Opportunity Candidate</option>
          <option value="disqualified">Disqualified</option>
        </Select>
        <Select className="form-input" style={{ maxWidth: 170, fontSize: 13 }} value={regionFilter} onChange={e => setRegionFilter(e.target.value)} aria-label="Filter by region">
          <option value="">All regions</option>
          {REGIONS.map(r => <option key={r.code} value={r.code}>{REGION_FILTER_LABEL[r.code] ?? r.label}</option>)}
        </Select>
        <Select className="form-input" style={{ maxWidth: 170, fontSize: 13 }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} aria-label="Filter by source">
          <option value="">All sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </Select>
        {/* "Missing info" isn't a DB column — completeness_percent is computed per-row
            (lib/marketing/prospectCompleteness.ts) from contact/location/source fields — the
            API filters on it after enrichment rather than in SQL, see app/api/marketing/
            prospects/route.ts's `completeness === 'missing'` branch. */}
        <Select className="form-input" style={{ maxWidth: 170, fontSize: 13 }} value={completenessFilter} onChange={e => setCompletenessFilter(e.target.value)} aria-label="Filter by info completeness">
          <option value="">All info levels</option>
          <option value="missing">Missing info</option>
        </Select>
        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQuery(''); setStatusFilter(''); setRegionFilter(''); setSourceFilter(''); setCompletenessFilter('');
              setCampaignFilter(''); setSurveyOnlyFilter(false); setProjectStatusFilter('');
            }}
          >
            Clear filters
          </button>
        )}
        {loading && <Loader2 size={15} style={{ color: 'var(--fg-subtle)', animation: 'spin 1s linear infinite' }} />}
        {hasFilters && total > 0 && (
          <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-sm" disabled={exporting} onClick={() => exportContacts('copy')} title="Copy every matching contact's email, comma-separated">
              <Copy size={13} style={{ marginRight: 5 }} /> Copy emails
            </button>
            <button className="btn btn-ghost btn-sm" disabled={exporting} onClick={() => exportContacts('csv')} title="Download name + email for every matching contact">
              <Download size={13} style={{ marginRight: 5 }} /> Download CSV
            </button>
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          {queryRequired && !hasAnyQuery ? (
            <>
              <Filter size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>Pick a campaign, survey, project status, or search above to pull a contact list.</div>
            </>
          ) : (
            <>
              <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>
                {hasFilters ? 'No contacts match your filters.' : <>No contacts yet.{canEdit && ' Click "Capture New Contact" to add the first one.'}</>}
              </div>
            </>
          )}
        </div></div>
      ) : (
        <>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Name</th>
                  <SortableTh label="01 - State" sortKeyName="state" />
                  <SortableTh label="13 - Source" sortKeyName="source" />
                  <SortableTh label="08 - Business Type" sortKeyName="business_type" />
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Assignee</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Due date</th>
                  <SortableTh label="Date created" sortKeyName="created_at" />
                  <SortableTh label="Information" sortKeyName="information" />
                  <SortableTh label="Whatsapp" sortKeyName="whatsapp" />
                  {canEdit && <th style={{ padding: '10px 12px', fontWeight: 600 }}></th>}
                </tr>
              </thead>
              <tbody style={{ opacity: loading ? 0.5 : 1 }}>
                {displayProspects.map(p => (
                  <Fragment key={p.id}>
                  <tr
                    onClick={() => setQuickViewId(p.id)}
                    style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {/* Companies always expand to their contact person(s), like ClickUp's
                            Company → Person rows — even with just one, the primary contact's
                            name is otherwise never shown anywhere on the collapsed row. */}
                        {(p.entity_type === 'organization' ? !!p.primary_contact || p.other_contacts.length > 0 : p.other_contacts.length > 0) ? (
                          <button
                            onClick={e => { e.stopPropagation(); toggleExpand(p.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, display: 'flex', transform: expandedIds.has(p.id) ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .1s' }}
                            aria-label={expandedIds.has(p.id) ? 'Collapse' : 'Expand'}
                          >
                            <ChevronDown size={13} />
                          </button>
                        ) : <span style={{ width: 13 }} />}
                        <EntityIcon type={p.entity_type} />
                        <span style={{ fontWeight: 600 }}>{p.display_name}</span>
                        {p.other_contacts.length > 0 && (
                          <span style={{ fontSize: 10.5, color: 'var(--fg-faint)' }}>+{p.other_contacts.length}</span>
                        )}
                        {(p.tags ?? []).map(t => <TagPill key={t.name} label={t.name} bg={t.color} />)}
                      </div>
                      {p.brand_name && <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginLeft: 20 }}>{p.brand_name}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>{p.state ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {canEdit ? (
                        <SourceSelect
                          value={p.source_raw_label || (p.source_label ? (SOURCE_LABEL[p.source_label as keyof typeof SOURCE_LABEL] ?? p.source_label) : null)}
                          options={sourceOptions}
                          onChange={v => updateSource(p, v)}
                        />
                      ) : (
                        <span style={{ color: 'var(--fg-subtle)' }}>
                          {p.source_raw_label || (p.source_label ? (SOURCE_LABEL[p.source_label as keyof typeof SOURCE_LABEL] ?? p.source_label) : '—')}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {canEdit ? (
                        <TagMultiSelect values={p.business_types ?? []} options={businessTypeOptions} onChange={v => updateBusinessTypes(p, v)} placeholder="Add…" />
                      ) : (p.business_types ?? []).length === 0 ? <span style={{ color: 'var(--fg-subtle)' }}>—</span> : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {(p.business_types ?? []).map(bt => <TagPill key={bt} label={bt} bg={hashColor(bt)} />)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                      {canEdit ? (
                        <Select
                          value={p.assigned_marketing_user_id ?? ''}
                          onChange={e => updateAssignee(p, e.target.value)}
                          className="form-input"
                          style={{ fontSize: 12, padding: '4px 6px', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', maxWidth: 150 }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                        >
                          <option value="">— Unassigned —</option>
                          {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                        </Select>
                      ) : (
                        <span style={{ color: 'var(--fg-subtle)' }}>{p.owner_name ?? '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.target_contact_date ? (
                        <span style={{ color: p.target_contact_date < todayIso ? 'var(--status-danger)' : 'var(--fg-subtle)' }}>
                          {new Date(p.target_contact_date).toLocaleDateString('en-US')}
                        </span>
                      ) : <span style={{ color: 'var(--fg-subtle)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-subtle)' }}>
                      {new Date(p.effective_created_at ?? p.external_created_at ?? p.created_at).toLocaleDateString('en-US')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.completeness_percent}%`, background: p.completeness_percent >= 80 ? 'var(--status-success)' : p.completeness_percent >= 40 ? 'var(--status-warning)' : 'var(--status-danger)' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{p.completeness_percent}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox" checked={p.whatsapp} disabled={!canEdit || !p.primary_contact_id}
                        onChange={() => toggleWhatsapp(p)}
                        style={{ accentColor: p.whatsapp ? 'var(--status-success)' : undefined, cursor: canEdit && p.primary_contact_id ? 'pointer' : 'default', width: 15, height: 15 }}
                      />
                    </td>
                    {canEdit && (
                      <td style={{ padding: '10px 12px' }}>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={e => trashProspect(e, p)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                  {expandedIds.has(p.id) && p.entity_type === 'organization' && p.primary_contact && (
                    <tr style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                      <td style={{ padding: '8px 12px 8px 41px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={13} style={{ color: 'var(--brand-orange-600)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5 }}>{p.primary_contact}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--fg-faint)', fontSize: 12 }}>{p.state ?? '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--fg-faint)', fontSize: 12 }}>
                        {p.source_raw_label || (p.source_label ? (SOURCE_LABEL[p.source_label as keyof typeof SOURCE_LABEL] ?? p.source_label) : '—')}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {(p.business_types ?? []).length === 0 ? <span style={{ color: 'var(--fg-faint)', fontSize: 12 }}>—</span> : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {(p.business_types ?? []).map(bt => <TagPill key={bt} label={bt} bg={hashColor(bt)} />)}
                          </div>
                        )}
                      </td>
                      <td />
                      <td />
                      <td />
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${p.completeness_percent}%`, background: p.completeness_percent >= 80 ? 'var(--status-success)' : p.completeness_percent >= 40 ? 'var(--status-warning)' : 'var(--status-danger)' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{p.completeness_percent}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="checkbox" checked={p.whatsapp} disabled={!canEdit || !p.primary_contact_id}
                          onChange={() => toggleWhatsapp(p)}
                          style={{ accentColor: p.whatsapp ? 'var(--status-success)' : undefined, cursor: canEdit && p.primary_contact_id ? 'pointer' : 'default', width: 15, height: 15 }}
                        />
                      </td>
                      {canEdit && <td />}
                    </tr>
                  )}
                  {expandedIds.has(p.id) && p.other_contacts.map(oc => (
                    <tr key={oc.id} style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                      <td style={{ padding: '8px 12px 8px 41px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={13} style={{ color: 'var(--brand-orange-600)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5 }}>{oc.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--fg-faint)', fontSize: 12 }}>{p.state ?? '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--fg-faint)', fontSize: 12 }}>
                        {p.source_raw_label || (p.source_label ? (SOURCE_LABEL[p.source_label as keyof typeof SOURCE_LABEL] ?? p.source_label) : '—')}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {(p.business_types ?? []).length === 0 ? <span style={{ color: 'var(--fg-faint)', fontSize: 12 }}>—</span> : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {(p.business_types ?? []).map(bt => <TagPill key={bt} label={bt} bg={hashColor(bt)} />)}
                          </div>
                        )}
                      </td>
                      <td />
                      <td />
                      <td />
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${oc.completeness_percent}%`, background: oc.completeness_percent >= 80 ? 'var(--status-success)' : oc.completeness_percent >= 40 ? 'var(--status-warning)' : 'var(--status-danger)' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{oc.completeness_percent}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="checkbox" checked={oc.whatsapp} disabled={!canEdit}
                          onChange={() => toggleContactWhatsapp(p, oc.id, oc.whatsapp)}
                          style={{ accentColor: oc.whatsapp ? 'var(--status-success)' : undefined, cursor: canEdit ? 'pointer' : 'default', width: 15, height: 15 }}
                        />
                      </td>
                      {canEdit && <td />}
                    </tr>
                  ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12.5, color: 'var(--fg-subtle)' }}>
            <span>Showing {from.toLocaleString('en-US')}–{to.toLocaleString('en-US')} of {total.toLocaleString('en-US')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>
                Next <ChevronRight size={14} />
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
