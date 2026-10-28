'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Megaphone, AlertTriangle, Copy, Check, Trash2, Plus, ArrowDown, ArrowUp, MoreHorizontal, Pencil, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/lib/usStates';
import type { CampaignStatus, CampaignType } from '@/types/database';
import { Select } from '@/components/platform/shared/Select';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';

export interface CampaignRow {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  campaign_type: CampaignType;
  source: string;
  city: string | null;
  state: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  status: CampaignStatus;
  owner_user_id: string | null;
  owner_name: string | null;
  created_at: string;
  submission_count: number;
  publicUrl: string;
}

interface Props {
  initialCampaigns: CampaignRow[];
  canEdit?: boolean;
  canSeeAll?: boolean;
  loadError?: boolean;
}

const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = { trade_fair: 'Trade Fair', event: 'Event' };
const STATUS_LABEL: Record<CampaignStatus, string> = { draft: 'Draft', active: 'Active', paused: 'Paused', closed: 'Closed' };
// Solid status chip (Figma "ACTIVE" = All Colors/Success/Success_Normal): fixed palette colors,
// white text — theme-independent so the chip stays readable in dark mode.
const STATUS_BG: Record<CampaignStatus, string> = {
  draft: 'var(--color-grey-500)',
  active: 'var(--color-success-normal)',
  paused: 'var(--color-warning-normal)',
  closed: 'var(--color-error-normal)',
};

// Figma "Campaigns & Surveys" (node 276:19068) — same toolbar/table styling as Contacts & Potentials.
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const PRIMARY_BTN = 'inline-flex h-10 items-center justify-center gap-3 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-6 text-[13px] font-semibold text-white no-underline hover:bg-[var(--color-secondary-700)]/90 disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950 [&_svg]:size-4';
const FILTER_STYLE: React.CSSProperties = {
  height: 40, fontSize: 12, borderRadius: 4, border: '1px solid var(--color-secondary-700)', background: 'var(--ui-input-bg)',
};
const TH_CLS = 'h-[46px] whitespace-nowrap px-2.5 text-left text-[12px] font-semibold leading-[1.4] text-ui-body';
const TD_CLS = 'px-2.5 py-2 text-[13px] text-ui-body';
const CHECKBOX_CLS = 'size-4 cursor-pointer accent-[var(--color-secondary-700)]';
const MENU_ITEM = 'flex w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-ui-body no-underline hover:bg-ui-hover-bg [&_svg]:size-3.5';

const DATE_UPPER = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_UPPER.format(d).toUpperCase();
}

const STATE_NAME = new Map(US_STATES.map(s => [s.abbr, s.name]));
function cityState(c: CampaignRow): string {
  const state = c.state ? (STATE_NAME.has(c.state) ? `${STATE_NAME.get(c.state)} (${c.state})` : c.state) : '';
  return [c.city, state].filter(Boolean).join(', ') || '—';
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0.5 text-ui-body hover:text-[var(--color-secondary-700)]"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success('Survey link copied');
          setTimeout(() => setCopied(false), 1500);
        } catch { toast.error('Could not copy link'); }
      }}
      title={`Copy public survey link — ${url}`}
      aria-label="Copy public survey link"
    >
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
    </button>
  );
}

export function CampaignsPageClient({ initialCampaigns, canEdit, canSeeAll, loadError }: Props) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [nameSort, setNameSort] = useState<'asc' | 'desc' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuId]);

  // Runs the existing per-campaign trash endpoint one by one — it carries its own auth + audit log.
  async function trashCampaigns(targets: CampaignRow[]) {
    if (targets.length === 0) return;
    const label = targets.length === 1 ? `"${targets[0].name}"` : `${targets.length} campaigns`;
    if (!window.confirm(`Delete ${label}? Public survey links stop working immediately. They stay in the database (recoverable), but disappear everywhere in the UI.`)) return;
    setBusy(true);
    const removed: string[] = [];
    let lastError = '';
    for (const c of targets) {
      const res = await fetch(`/api/marketing/campaigns/${c.id}/trash`, { method: 'POST' }).catch(() => null);
      if (res?.ok) removed.push(c.id);
      else lastError = res ? ((await res.json().catch(() => ({}))).error ?? '') : '';
    }
    setBusy(false);
    setCampaigns(prev => prev.filter(x => !removed.includes(x.id)));
    setSelected(new Set());
    if (removed.length) toast.success(`Deleted ${removed.length} campaign${removed.length === 1 ? '' : 's'}`);
    if (removed.length < targets.length) toast.error(lastError || 'Could not delete some campaigns');
  }

  // Active campaigns always lead, regardless of sort/search — they're the ones someone might
  // actually need to act on right now (draft/paused/closed are reference/history). A name sort,
  // when picked, overrides that.
  const STATUS_RANK: Record<CampaignStatus, number> = { active: 0, draft: 1, paused: 2, closed: 3 };
  const filtered = useMemo(() => {
    const rows = campaigns
      .filter(c => {
        if (statusFilter && c.status !== statusFilter) return false;
        if (typeFilter && c.campaign_type !== typeFilter) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return c.name.toLowerCase().includes(q)
          || (c.code ?? '').toLowerCase().includes(q)
          || (c.city ?? '').toLowerCase().includes(q)
          || (c.state ?? '').toLowerCase().includes(q)
          || (c.owner_name ?? '').toLowerCase().includes(q);
      });
    if (nameSort) {
      const dir = nameSort === 'asc' ? 1 : -1;
      return rows.sort((a, b) => dir * a.name.localeCompare(b.name));
    }
    return rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]
      || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  }, [campaigns, query, statusFilter, typeFilter, nameSort]);

  const selectedRows = filtered.filter(c => selected.has(c.id));
  const allSelected = filtered.length > 0 && selectedRows.length === filtered.length;

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loadError) {
    return (
      <div className="rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-12 text-center text-[13px] text-ui-text-secondary">
        <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: 'var(--status-t7-fg)' }} />
        <div>Campaigns & Surveys isn&apos;t ready yet. Migration 086 needs to be applied.</div>
      </div>
    );
  }

  return (
    <div className="w-full pb-12">
      <div className="mb-[18px] flex flex-col gap-[5px] leading-[1.35]">
        <p className="m-0 text-[11px] font-semibold text-ui-nav-active">Marketing / Campaigns &amp; Surveys</p>
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>Campaigns &amp; Surveys</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}{canSeeAll ? '' : ' — yours'} · each one has its own public survey link and QR code.
        </p>
      </div>

      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] max-w-[380px] flex-[1_1_220px]">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
          <input
            className="form-input"
            style={{ height: 40, paddingLeft: 34, fontSize: 13, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)' }}
            placeholder="Search campaigns…" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search campaigns"
          />
        </div>
        <Select className="form-input" style={{ ...FILTER_STYLE, maxWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All Statuses</option>
          {(['draft', 'active', 'paused', 'closed'] as CampaignStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
        <Select className="form-input" style={{ ...FILTER_STYLE, maxWidth: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by type">
          <option value="">All Types</option>
          {(['trade_fair', 'event'] as CampaignType[]).map(t => <option key={t} value={t}>{CAMPAIGN_TYPE_LABEL[t]}</option>)}
        </Select>
        <span className="ml-auto flex items-center gap-2.5">
          {canEdit && selectedRows.length > 0 && (
            <>
              <span className="text-[12px] text-ui-text-secondary">{selectedRows.length} selected</span>
              <button
                type="button" disabled={busy} onClick={() => trashCampaigns(selectedRows)}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[6px] border-0 px-4 text-[13px] font-medium hover:brightness-95 disabled:opacity-50 [&_svg]:size-4"
                style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
              >
                <Trash2 aria-hidden /> Delete selected
              </button>
            </>
          )}
          {canEdit && (
            <Link href="/marketing/campaigns/new" className={PRIMARY_BTN}><Plus aria-hidden /> New Campaign</Link>
          )}
        </span>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-[6px] border border-ui-divider bg-ui-page-bg">
          <EmptyState
            icon={<Megaphone />}
            title="No campaigns yet"
            description="Campaigns collect submissions from a shared form link."
            action={canEdit && (
              <Link href="/marketing/campaigns/new" className={buttonVariants()}><Plus /> Create first campaign</Link>
            )}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[6px] border border-ui-divider bg-ui-page-bg p-12 text-center text-[13px] text-ui-text-secondary">
          No campaigns match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border border-ui-divider bg-ui-page-bg">
          <table className="w-full border-collapse" style={{ minWidth: 1100, opacity: busy ? 0.6 : 1 }}>
            <thead>
              <tr className="border-b border-ui-divider bg-ui-surface">
                <th className={cn(TH_CLS, 'w-9 pl-[18px]')}>
                  <input
                    type="checkbox" className={CHECKBOX_CLS} checked={allSelected} aria-label="Select all"
                    onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map(c => c.id)))}
                  />
                </th>
                <th className={TH_CLS} aria-sort={nameSort ? (nameSort === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button
                    type="button"
                    onClick={() => setNameSort(s => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))}
                    className="inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-[inherit] text-[inherit]"
                    title="Sort by campaign name"
                  >
                    Campaign
                    {nameSort === 'asc' ? <ArrowUp size={12} aria-hidden /> : nameSort === 'desc' ? <ArrowDown size={12} aria-hidden /> : null}
                  </button>
                </th>
                <th className={TH_CLS}>Status</th>
                <th className={TH_CLS}>Type</th>
                <th className={TH_CLS}>City/State</th>
                <th className={TH_CLS}>Start Date</th>
                <th className={TH_CLS}>End Date</th>
                <th className={cn(TH_CLS, 'text-center')}>Submissions</th>
                <th className={TH_CLS}>Created</th>
                <th className={cn(TH_CLS, 'w-12 pr-[18px]')}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const isSelected = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/marketing/campaigns/${c.id}`)}
                    className={cn('h-16 cursor-pointer border-t border-ui-divider hover:bg-ui-surface', isSelected && 'bg-ui-selected-bg')}
                  >
                    <td className={cn(TD_CLS, 'pl-[18px]')} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className={CHECKBOX_CLS} checked={isSelected} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
                    </td>
                    <td className={cn(TD_CLS, 'max-w-[260px]')}>
                      <div className="flex items-center gap-2">
                        <span className={cn('truncate text-[13px] font-semibold', HEADING_TEXT)}>{c.name}</span>
                        <CopyLinkButton url={c.publicUrl} />
                      </div>
                      {c.code && <div className="text-[11px] text-ui-text-secondary">{c.code}</div>}
                    </td>
                    <td className={TD_CLS}>
                      <span
                        className="inline-flex items-center rounded-[4px] px-2.5 py-[3px] text-[11px] font-medium uppercase leading-4"
                        style={{ background: STATUS_BG[c.status], color: '#fff' }}
                      >
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className={TD_CLS}>{CAMPAIGN_TYPE_LABEL[c.campaign_type]}</td>
                    <td className={cn(TD_CLS, 'max-w-[200px] truncate')}>{cityState(c)}</td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>{formatDate(c.start_date)}</td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>{formatDate(c.end_date)}</td>
                    <td className={cn(TD_CLS, 'text-center')}>{c.submission_count}</td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>{formatDate(c.created_at)}</td>
                    <td className={cn(TD_CLS, 'pr-[18px]')} onClick={e => e.stopPropagation()}>
                      <div className="relative" ref={menuId === c.id ? menuRef : undefined}>
                        <button
                          type="button"
                          aria-label={`Actions for ${c.name}`}
                          aria-haspopup="menu"
                          aria-expanded={menuId === c.id}
                          onClick={() => setMenuId(id => (id === c.id ? null : c.id))}
                          className="grid size-8 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"
                        >
                          <MoreHorizontal size={16} aria-hidden />
                        </button>
                        {menuId === c.id && (
                          <div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-20 flex min-w-[170px] flex-col gap-0.5 rounded-[6px] border border-ui-input-border bg-ui-page-bg p-1.5 shadow-md">
                            <Link role="menuitem" href={`/marketing/campaigns/${c.id}`} className={MENU_ITEM}><ExternalLink aria-hidden /> Open</Link>
                            {canEdit && c.status !== 'closed' && (
                              <Link role="menuitem" href={`/marketing/campaigns/${c.id}/edit`} className={MENU_ITEM}><Pencil aria-hidden /> Edit</Link>
                            )}
                            {canEdit && (
                              <button
                                type="button" role="menuitem" className={MENU_ITEM}
                                style={{ color: 'var(--status-t10-fg)' }}
                                onClick={() => { setMenuId(null); void trashCampaigns([c]); }}
                              >
                                <Trash2 aria-hidden /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
