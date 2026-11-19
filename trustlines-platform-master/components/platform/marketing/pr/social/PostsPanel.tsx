'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Pencil, Plus, Search, Share2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { POST_METRICS, engagementOf, engagementRate, platformLabel } from '@/lib/marketing/prWorkspace';
import type { CampaignOption, SocialAccountRow, SocialPostRow } from '@/lib/marketing/prWorkspaceServer';
import { PANEL, PlatformMark, TD_CLS, TH_CLS, fmtDay, fmtNumber } from '@/components/platform/marketing/pr/shared';
import { FILTER_STATUS_OPTIONS, fmtWhen } from './socialForms';

/**
 * Search / status / account filters for the posts list. Lives in the parent (not PostsPanel)
 * so the filters survive switching to the Accounts tab and back.
 */
export function usePostFilters(posts: SocialPostRow[]) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter(p =>
      (!statusFilter || p.status === statusFilter)
      && (!accountFilter || p.account_id === accountFilter)
      && (!q || p.title.toLowerCase().includes(q) || (p.caption ?? '').toLowerCase().includes(q)),
    ).sort((a, b) => (b.published_on ?? b.planned_on ?? '').localeCompare(a.published_on ?? a.planned_on ?? ''));
  }, [posts, query, statusFilter, accountFilter]);
  return { query, setQuery, statusFilter, setStatusFilter, accountFilter, setAccountFilter, visiblePosts };
}

export function PostsPanel({ filters, totalPosts, accounts, accountById, campaignById, today, canEdit, mayDelete, onOpen, onDelete, onNew }: {
  filters: ReturnType<typeof usePostFilters>;
  totalPosts: number;
  accounts: SocialAccountRow[];
  accountById: Map<string, SocialAccountRow>;
  campaignById: Map<string, CampaignOption>;
  today: string | null;
  canEdit: boolean;
  mayDelete: (createdBy: string | null) => boolean;
  onOpen: (p: SocialPostRow) => void;
  onDelete: (p: SocialPostRow) => void;
  onNew: () => void;
}) {
  const { visiblePosts } = filters;
  return (
    <div className={cn(PANEL, 'flex flex-col gap-5 p-6')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[320px]">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
          <Input className="h-10 pl-8 dark:pl-8 text-[13px]" placeholder="Search posts…" value={filters.query} onChange={e => filters.setQuery(e.target.value)} aria-label="Search posts" />
        </div>
        <Select className="h-10 w-[160px] text-[13px]" aria-label="Filter by status" value={filters.statusFilter}
          options={[{ value: '', label: 'All statuses' }, ...FILTER_STATUS_OPTIONS]} onValueChange={v => filters.setStatusFilter(v ?? '')} />
        <Select className="h-10 w-[220px] text-[13px]" aria-label="Filter by account" value={filters.accountFilter}
          options={[{ value: '', label: 'All accounts' }, ...accounts.map(a => ({ value: a.id, label: `${platformLabel(a.platform)} · ${a.handle}` }))]}
          onValueChange={v => filters.setAccountFilter(v ?? '')} />
      </div>

      {visiblePosts.length === 0 ? (
        <EmptyState
          icon={<Share2 />}
          title={totalPosts ? 'No post matches your filters' : 'No posts yet'}
          description={totalPosts ? 'Clear the search or pick another status.' : 'Add a post idea, schedule it, then record its results once it is live.'}
          action={canEdit && !totalPosts ? <Button onClick={onNew}><Plus /> New post</Button> : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-ui-divider">
                <th className={TH_CLS}>Post</th><th className={TH_CLS}>Account</th><th className={TH_CLS}>Status</th>
                <th className={TH_CLS}>Date</th><th className={cn(TH_CLS, 'text-right')}>Impressions</th>
                <th className={cn(TH_CLS, 'text-right')}>Engagement</th><th className={cn(TH_CLS, 'text-right')}>Rate</th>
                <th className={TH_CLS}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visiblePosts.map(p => {
                const account = p.account_id ? accountById.get(p.account_id) : undefined;
                const rate = engagementRate(p);
                const hasResults = POST_METRICS.some(m => p[m] !== null);
                return (
                  <tr key={p.id} className="border-b border-ui-divider last:border-b-0">
                    <td className={TD_CLS}>
                      <button type="button" className="block max-w-[320px] cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-ui-heading hover:underline"
                        onClick={() => onOpen(p)}>
                        {p.title}
                      </button>
                      <span className="block max-w-[320px] truncate text-ui-text-secondary">
                        {p.campaign_id ? campaignById.get(p.campaign_id)?.name ?? '' : ''}{p.campaign_id && p.caption ? ' · ' : ''}{p.caption}
                      </span>
                    </td>
                    <td className={TD_CLS}>
                      {account ? <span className="inline-flex items-center gap-2"><PlatformMark platform={account.platform} size={20} />{account.handle}</span> : <span className="text-ui-text-secondary">—</span>}
                    </td>
                    <td className={TD_CLS}>
                      <span className="inline-flex flex-col gap-0.5" title={p.publish_error ?? undefined}>
                        <StatusBadge group="social_post" status={p.status} size="sm" />
                        {p.status === 'failed' && p.publish_error && <span className="max-w-[180px] truncate text-[11px] text-error-dark">{p.publish_error}</span>}
                        {p.source === 'synced' && <span className="text-[11px] text-ui-text-secondary">From the platform</span>}
                      </span>
                    </td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>
                      {p.published_on ? fmtDay(p.published_on)
                        // Local time only after mount (`today` is set then) — the server renders in UTC.
                        : p.status === 'scheduled' && p.scheduled_at && today ? <>Auto {fmtWhen(p.scheduled_at)}</>
                          : p.planned_on ? <>Planned {fmtDay(p.planned_on)}</> : '—'}
                    </td>
                    <td className={cn(TD_CLS, 'text-right tabular-nums')}>{fmtNumber(p.impressions ?? p.reach)}</td>
                    <td className={cn(TD_CLS, 'text-right tabular-nums')}>{hasResults ? fmtNumber(engagementOf(p)) : '—'}</td>
                    <td className={cn(TD_CLS, 'text-right tabular-nums')}>{rate === null ? '—' : `${rate}%`}</td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap text-right')}>
                      {p.post_url && (
                        <a href={p.post_url} target="_blank" rel="noreferrer" aria-label={`Open "${p.title}" on the platform`}
                          className="inline-grid size-7 place-items-center rounded-[4px] text-ui-body hover:bg-ui-hover-bg"><ExternalLink size={14} /></a>
                      )}
                      {canEdit && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit "${p.title}"`} onClick={() => onOpen(p)}><Pencil /></Button>
                      )}
                      {mayDelete(p.created_by) && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete "${p.title}"`} onClick={() => onDelete(p)}>
                          <Trash2 className="text-error-normal" />
                        </Button>
                      )}
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
