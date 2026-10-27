'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AtSign, CalendarClock, ExternalLink, Heart, LineChart, Pencil, Plus, Search, Send, Share2, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/feedback-states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import {
  POST_METRICS, SOCIAL_PLATFORMS, SOCIAL_POST_STATUSES, engagementOf, engagementRate, followerGrowth, platformLabel,
  type PostMetric,
} from '@/lib/marketing/prWorkspace';
import type { CampaignOption, FollowerStatRow, SocialAccountRow, SocialPostRow } from '@/lib/marketing/prWorkspaceServer';
import { Field, PANEL, PageHeading, PlatformMark, TD_CLS, TH_CLS, fmtDay, fmtNumber, localToday, sendJson } from './shared';

interface SocialData { accounts: SocialAccountRow[]; posts: SocialPostRow[]; stats: FollowerStatRow[] }

interface Props {
  initial: SocialData | null;
  campaigns: CampaignOption[];
  canEdit: boolean;
  isManager: boolean;
  userId: string;
  /** Set when the page couldn't load (e.g. migration 127 not applied). */
  loadError: string | null;
  /** ?post=<id> — opens that post (the Calendar links here). */
  openPostId?: string | null;
}

const STATUS_OPTIONS = SOCIAL_POST_STATUSES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));
const METRIC_LABEL: Record<PostMetric, string> = {
  impressions: 'Impressions', reach: 'Reach', likes: 'Likes', comments: 'Comments', shares: 'Shares', saves: 'Saves', clicks: 'Link clicks',
};

type Tab = 'posts' | 'accounts';
type PostForm = Record<'account_id' | 'title' | 'caption' | 'status' | 'planned_on' | 'published_on' | 'post_url' | 'campaign_id' | 'notes' | PostMetric, string>;
type AccountForm = { platform: string; handle: string; profile_url: string; notes: string; is_active: boolean };

const emptyPost = (date = ''): PostForm => ({
  account_id: '', title: '', caption: '', status: date ? 'scheduled' : 'idea', planned_on: date, published_on: '', post_url: '',
  campaign_id: '', notes: '', impressions: '', reach: '', likes: '', comments: '', shares: '', saves: '', clicks: '',
});
const toPostForm = (p: SocialPostRow): PostForm => ({
  account_id: p.account_id ?? '', title: p.title, caption: p.caption ?? '', status: p.status, planned_on: p.planned_on ?? '',
  published_on: p.published_on ?? '', post_url: p.post_url ?? '', campaign_id: p.campaign_id ?? '', notes: p.notes ?? '',
  ...Object.fromEntries(POST_METRICS.map(m => [m, p[m] === null ? '' : String(p[m])])) as Record<PostMetric, string>,
});

export function SocialMediaClient({ initial, campaigns, canEdit, isManager, userId, loadError, openPostId }: Props) {
  const [data, setData] = useState<SocialData>(initial ?? { accounts: [], posts: [], stats: [] });
  const [tab, setTab] = useState<Tab>('posts');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [today, setToday] = useState<string | null>(null);

  const [postEdit, setPostEdit] = useState<{ id: string | null; form: PostForm } | null>(null);
  const [accountEdit, setAccountEdit] = useState<{ id: string | null; form: AccountForm } | null>(null);
  const [followersFor, setFollowersFor] = useState<SocialAccountRow | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: 'post' | 'account'; id: string; label: string } | null>(null);

  // "Today" is the viewer's own day, so it is read after mount (the server renders in UTC).
  useEffect(() => { setToday(localToday()); }, []);

  useEffect(() => {
    if (!openPostId) return;
    const p = data.posts.find(x => x.id === openPostId);
    if (p) setPostEdit({ id: p.id, form: toPostForm(p) });
    // Only on first load — the Calendar opens one post per visit.
  }, [openPostId]);

  async function reload() {
    try {
      setData(await sendJson<SocialData>('/api/marketing/social', 'GET'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reload');
    }
  }

  const accountById = useMemo(() => new Map(data.accounts.map(a => [a.id, a])), [data.accounts]);
  const campaignById = useMemo(() => new Map(campaigns.map(c => [c.id, c])), [campaigns]);
  const statsByAccount = useMemo(() => {
    const m = new Map<string, FollowerStatRow[]>();
    for (const s of data.stats) m.set(s.account_id, [...(m.get(s.account_id) ?? []), s]);
    return m;
  }, [data.stats]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    let latestTotal = 0, prevTotal = 0, comparable = 0;
    for (const a of data.accounts.filter(x => x.is_active)) {
      const sorted = [...(statsByAccount.get(a.id) ?? [])].sort((x, y) => y.recorded_on.localeCompare(x.recorded_on));
      if (sorted[0]) latestTotal += sorted[0].followers;
      if (sorted[1]) { comparable += sorted[0].followers; prevTotal += sorted[1].followers; }
    }
    const followerTrend = prevTotal > 0 ? Math.round(((comparable - prevTotal) / prevTotal) * 1000) / 10 : null;
    if (!today) return { latestTotal, followerTrend, publishedThisMonth: null, scheduled: null, avgRate: null };
    const month = today.slice(0, 7);
    const since = new Date(`${today}T00:00:00Z`); since.setUTCDate(since.getUTCDate() - 30);
    const sinceIso = since.toISOString().slice(0, 10);
    const published = data.posts.filter(p => p.status === 'published');
    const rates = published.filter(p => p.published_on && p.published_on >= sinceIso).map(engagementRate).filter((r): r is number => r !== null);
    return {
      latestTotal, followerTrend,
      publishedThisMonth: published.filter(p => p.published_on?.startsWith(month)).length,
      scheduled: data.posts.filter(p => p.status === 'scheduled' && (!p.planned_on || p.planned_on >= today)).length,
      avgRate: rates.length ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10 : null,
    };
  }, [data, statsByAccount, today]);

  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.posts.filter(p =>
      (!statusFilter || p.status === statusFilter)
      && (!accountFilter || p.account_id === accountFilter)
      && (!q || p.title.toLowerCase().includes(q) || (p.caption ?? '').toLowerCase().includes(q)),
    ).sort((a, b) => (b.published_on ?? b.planned_on ?? '').localeCompare(a.published_on ?? a.planned_on ?? ''));
  }, [data.posts, query, statusFilter, accountFilter]);

  const accountOptions = [{ value: '', label: 'No account' }, ...data.accounts.filter(a => a.is_active).map(a => ({ value: a.id, label: `${platformLabel(a.platform)} · ${a.handle}` }))];
  const campaignOptions = [{ value: '', label: 'No campaign' }, ...campaigns.map(c => ({ value: c.id, label: c.name }))];
  const mayDelete = (createdBy: string | null) => canEdit && (isManager || createdBy === userId);

  async function savePost() {
    if (!postEdit) return;
    const { id, form } = postEdit;
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    try {
      await sendJson(id ? `/api/marketing/social/posts/${id}` : '/api/marketing/social/posts', id ? 'PATCH' : 'POST', form);
      toast.success(id ? 'Post saved' : 'Post added');
      setPostEdit(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the post');
    }
  }

  async function saveAccount() {
    if (!accountEdit) return;
    const { id, form } = accountEdit;
    if (!form.platform || !form.handle.trim()) { toast.error('Pick a platform and enter the account name'); return; }
    try {
      await sendJson(id ? `/api/marketing/social/accounts/${id}` : '/api/marketing/social/accounts', id ? 'PATCH' : 'POST', form);
      toast.success(id ? 'Account saved' : 'Account added');
      setAccountEdit(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the account');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await sendJson(`/api/marketing/social/${toDelete.kind === 'post' ? 'posts' : 'accounts'}/${toDelete.id}`, 'DELETE');
      toast.success(toDelete.kind === 'post' ? 'Post deleted' : 'Account removed');
      setToDelete(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
      throw e; // keeps the dialog open
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-[30px]">
        <PageHeading trail="Marketing / Social Media" title="Social Media" subtitle="Accounts, follower growth and post results in one place." />
        <div className={cn(PANEL, 'p-6')}><ErrorState title="Social media tracking isn’t available" description={loadError} /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeading
        trail="Marketing / Social Media"
        title="Social Media"
        subtitle="Plan posts, record their results and track follower growth. Numbers are entered by the team from each platform’s insights."
        actions={canEdit && (
          <>
            <Button variant="secondary" onClick={() => setAccountEdit({ id: null, form: { platform: '', handle: '', profile_url: '', notes: '', is_active: true } })}>
              <AtSign /> Add account
            </Button>
            <Button onClick={() => setPostEdit({ id: null, form: emptyPost() })}><Plus /> New post</Button>
          </>
        )}
      />

      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Users />} label="Total followers" value={fmtNumber(kpis.latestTotal)}
          trend={kpis.followerTrend !== null ? { value: kpis.followerTrend, context: 'since the previous count' } : undefined}
          badge={kpis.followerTrend === null ? { label: `${data.accounts.filter(a => a.is_active).length} accounts`, tone: 'neutral' } : undefined}
        />
        <KpiCard icon={<Send />} label="Published this month" value={kpis.publishedThisMonth ?? '—'} loading={!today} />
        <KpiCard icon={<CalendarClock />} label="Scheduled" value={kpis.scheduled ?? '—'} loading={!today} href="/marketing/calendar" />
        <KpiCard
          icon={<Heart />} label="Avg. engagement (30 days)" value={kpis.avgRate === null ? '—' : `${kpis.avgRate}%`} loading={!today}
          badge={kpis.avgRate === null && today ? { label: 'Add post results', tone: 'neutral' } : undefined}
        />
      </div>

      <nav aria-label="Social media views" className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
        {([['posts', 'Posts', data.posts.length], ['accounts', 'Accounts', data.accounts.length]] as const).map(([key, label, count]) => (
          <button
            key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 border-0 border-b-[3px] bg-transparent p-0 text-[13px] leading-[1.4]',
              tab === key
                ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'cursor-pointer border-transparent text-ui-text-secondary hover:text-ui-body',
            )}
          >
            {label}<span className="text-[11px] opacity-75">({count})</span>
          </button>
        ))}
      </nav>

      {tab === 'posts' ? (
        <div className={cn(PANEL, 'flex flex-col gap-5 p-6')}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-[320px]">
              <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
              <Input className="h-10 pl-8 text-[13px]" placeholder="Search posts…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search posts" />
            </div>
            <Select className="h-10 w-[160px] text-[13px]" aria-label="Filter by status" value={statusFilter}
              options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]} onValueChange={v => setStatusFilter(v ?? '')} />
            <Select className="h-10 w-[220px] text-[13px]" aria-label="Filter by account" value={accountFilter}
              options={[{ value: '', label: 'All accounts' }, ...data.accounts.map(a => ({ value: a.id, label: `${platformLabel(a.platform)} · ${a.handle}` }))]}
              onValueChange={v => setAccountFilter(v ?? '')} />
          </div>

          {visiblePosts.length === 0 ? (
            <EmptyState
              icon={<Share2 />}
              title={data.posts.length ? 'No post matches your filters' : 'No posts yet'}
              description={data.posts.length ? 'Clear the search or pick another status.' : 'Add a post idea, schedule it, then record its results once it is live.'}
              action={canEdit && !data.posts.length ? <Button onClick={() => setPostEdit({ id: null, form: emptyPost() })}><Plus /> New post</Button> : undefined}
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
                            onClick={() => setPostEdit({ id: p.id, form: toPostForm(p) })}>
                            {p.title}
                          </button>
                          <span className="block max-w-[320px] truncate text-ui-text-secondary">
                            {p.campaign_id ? campaignById.get(p.campaign_id)?.name ?? '' : ''}{p.campaign_id && p.caption ? ' · ' : ''}{p.caption}
                          </span>
                        </td>
                        <td className={TD_CLS}>
                          {account ? <span className="inline-flex items-center gap-2"><PlatformMark platform={account.platform} size={20} />{account.handle}</span> : <span className="text-ui-text-secondary">—</span>}
                        </td>
                        <td className={TD_CLS}><StatusBadge group="social_post" status={p.status} size="sm" /></td>
                        <td className={cn(TD_CLS, 'whitespace-nowrap')}>
                          {p.published_on ? fmtDay(p.published_on) : p.planned_on ? <>Planned {fmtDay(p.planned_on)}</> : '—'}
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
                            <Button variant="ghost" size="icon-sm" aria-label={`Edit "${p.title}"`} onClick={() => setPostEdit({ id: p.id, form: toPostForm(p) })}><Pencil /></Button>
                          )}
                          {mayDelete(p.created_by) && (
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete "${p.title}"`} onClick={() => setToDelete({ kind: 'post', id: p.id, label: p.title })}>
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
      ) : data.accounts.length === 0 ? (
        <div className={cn(PANEL, 'p-6')}>
          <EmptyState
            icon={<AtSign />} title="No accounts yet"
            description="Add the company’s Instagram, LinkedIn and other accounts to start tracking followers."
            action={canEdit ? <Button onClick={() => setAccountEdit({ id: null, form: { platform: '', handle: '', profile_url: '', notes: '', is_active: true } })}><Plus /> Add account</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.accounts.map(a => {
            const history = statsByAccount.get(a.id) ?? [];
            const g = followerGrowth(history);
            const posts = data.posts.filter(p => p.account_id === a.id && p.status === 'published').length;
            return (
              <div key={a.id} className={cn(PANEL, 'flex flex-col gap-4 p-5', !a.is_active && 'opacity-70')}>
                <div className="flex items-start gap-3">
                  <PlatformMark platform={a.platform} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-ui-heading">{a.handle}</div>
                    <div className="text-[12px] text-ui-text-secondary">{platformLabel(a.platform)}{a.is_active ? '' : ' · inactive'}</div>
                  </div>
                  {a.profile_url && (
                    <a href={a.profile_url} target="_blank" rel="noreferrer" aria-label={`Open ${a.handle}`}
                      className="inline-grid size-7 place-items-center rounded-[4px] text-ui-body hover:bg-ui-hover-bg"><ExternalLink size={14} /></a>
                  )}
                </div>
                <dl className="m-0 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] text-ui-text-secondary">Followers</dt>
                    <dd className="m-0 flex items-baseline gap-2 text-[22px] font-semibold tabular-nums text-ui-heading">
                      {fmtNumber(g.latest)}
                      {g.changePct !== null && (
                        <span className={cn('rounded-tag px-1.5 text-[11px] font-medium', g.changePct >= 0 ? 'bg-success-light text-success-dark' : 'bg-error-light text-error-dark')}>
                          {g.changePct >= 0 ? '+' : ''}{g.changePct}%
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ui-text-secondary">Published posts</dt>
                    <dd className="m-0 text-[22px] font-semibold tabular-nums text-ui-heading">{posts}</dd>
                  </div>
                </dl>
                <div className="text-[11px] text-ui-text-secondary">
                  {history.length
                    ? `Last counted ${fmtDay(history.reduce((d, s) => (s.recorded_on > d ? s.recorded_on : d), ''))}`
                    : 'No follower count recorded yet'}
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setFollowersFor(a)}><LineChart /> Record followers</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${a.handle}`}
                      onClick={() => setAccountEdit({ id: a.id, form: { platform: a.platform, handle: a.handle, profile_url: a.profile_url ?? '', notes: a.notes ?? '', is_active: a.is_active } })}>
                      <Pencil />
                    </Button>
                    {mayDelete(a.created_by) && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${a.handle}`} onClick={() => setToDelete({ kind: 'account', id: a.id, label: a.handle })}>
                        <Trash2 className="text-error-normal" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Post dialog ── */}
      <Modal open={!!postEdit} onOpenChange={o => { if (!o) setPostEdit(null); }}>
        {postEdit && (
          <ModalContent
            size="lg"
            title={postEdit.id ? 'Edit post' : 'New post'}
            description="Results can be added later, once the post is live."
            footer={canEdit && (
              <>
                <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
                <Button onClick={savePost}>{postEdit.id ? 'Save post' : 'Add post'}</Button>
              </>
            )}
          >
            <PostFields
              form={postEdit.form} disabled={!canEdit} accountOptions={accountOptions} campaignOptions={campaignOptions}
              onChange={patch => setPostEdit(p => (p ? { ...p, form: { ...p.form, ...patch } } : p))}
            />
          </ModalContent>
        )}
      </Modal>

      {/* ── Account dialog ── */}
      <Modal open={!!accountEdit} onOpenChange={o => { if (!o) setAccountEdit(null); }}>
        {accountEdit && (
          <ModalContent
            title={accountEdit.id ? 'Edit account' : 'Add account'}
            footer={(
              <>
                <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
                <Button onClick={saveAccount}>{accountEdit.id ? 'Save account' : 'Add account'}</Button>
              </>
            )}
          >
            <div className="flex flex-col gap-4">
              <Field label="Platform">
                <Select aria-label="Platform" placeholder="Pick a platform" value={accountEdit.form.platform}
                  options={SOCIAL_PLATFORMS.map(p => ({ value: p.value, label: p.label }))}
                  onValueChange={v => setAccountEdit(a => (a ? { ...a, form: { ...a.form, platform: v ?? '' } } : a))} />
              </Field>
              <Field label="Account name / handle" htmlFor="acc-handle">
                <Input id="acc-handle" placeholder="@tlines" value={accountEdit.form.handle}
                  onChange={e => setAccountEdit(a => (a ? { ...a, form: { ...a.form, handle: e.target.value } } : a))} />
              </Field>
              <Field label="Profile link" htmlFor="acc-url">
                <Input id="acc-url" type="url" placeholder="https://www.instagram.com/…" value={accountEdit.form.profile_url}
                  onChange={e => setAccountEdit(a => (a ? { ...a, form: { ...a.form, profile_url: e.target.value } } : a))} />
              </Field>
              <Field label="Notes" htmlFor="acc-notes">
                <Textarea id="acc-notes" rows={3} value={accountEdit.form.notes}
                  onChange={e => setAccountEdit(a => (a ? { ...a, form: { ...a.form, notes: e.target.value } } : a))} />
              </Field>
              {accountEdit.id && (
                <label className="flex items-center gap-2 text-[12px] text-ui-body">
                  <input type="checkbox" className="size-4 accent-[var(--color-secondary-700)]" checked={accountEdit.form.is_active}
                    onChange={e => setAccountEdit(a => (a ? { ...a, form: { ...a.form, is_active: e.target.checked } } : a))} />
                  Active — shown in totals and in the account list for new posts
                </label>
              )}
            </div>
          </ModalContent>
        )}
      </Modal>

      {followersFor && (
        <FollowersDialog
          account={followersFor} history={statsByAccount.get(followersFor.id) ?? []} today={today}
          onClose={() => setFollowersFor(null)} onSaved={reload}
        />
      )}

      <ConfirmModal
        open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}
        title={toDelete?.kind === 'post' ? 'Delete this post?' : 'Remove this account?'}
        description={toDelete?.label}
        tone="destructive" confirmLabel={toDelete?.kind === 'post' ? 'Delete post' : 'Remove account'}
        warning={toDelete?.kind === 'account' ? 'Its posts and follower history are kept, but the account no longer appears here.' : undefined}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function PostFields({ form, disabled, accountOptions, campaignOptions, onChange }: {
  form: PostForm; disabled: boolean;
  accountOptions: { value: string; label: string }[]; campaignOptions: { value: string; label: string }[];
  onChange: (patch: Partial<PostForm>) => void;
}) {
  const showResults = form.status === 'published' || POST_METRICS.some(m => form[m] !== '');
  return (
    <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <Field label="Title" htmlFor="post-title">
        <Input id="post-title" placeholder="e.g. NACS booth recap" value={form.title} onChange={e => onChange({ title: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Account">
          <Select aria-label="Account" value={form.account_id} options={accountOptions} onValueChange={v => onChange({ account_id: v ?? '' })} disabled={disabled} />
        </Field>
        <Field label="Status">
          <Select aria-label="Status" value={form.status} options={STATUS_OPTIONS} onValueChange={v => onChange({ status: v ?? 'idea' })} disabled={disabled} />
        </Field>
        <Field label="Planned date" htmlFor="post-planned">
          <Input id="post-planned" type="date" value={form.planned_on} onChange={e => onChange({ planned_on: e.target.value })} />
        </Field>
        <Field label="Published date" htmlFor="post-published" hint={form.status === 'published' && !form.published_on ? 'Left empty, the planned date (or today) is used.' : undefined}>
          <Input id="post-published" type="date" value={form.published_on} onChange={e => onChange({ published_on: e.target.value })} />
        </Field>
      </div>
      <Field label="Caption" htmlFor="post-caption">
        <Textarea id="post-caption" rows={4} value={form.caption} onChange={e => onChange({ caption: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Campaign">
          <Select aria-label="Campaign" value={form.campaign_id} options={campaignOptions} onValueChange={v => onChange({ campaign_id: v ?? '' })} disabled={disabled} />
        </Field>
        <Field label="Post link" htmlFor="post-url">
          <Input id="post-url" type="url" placeholder="https://…" value={form.post_url} onChange={e => onChange({ post_url: e.target.value })} />
        </Field>
      </div>
      {showResults && (
        <div className="flex flex-col gap-3 rounded-[8px] border border-ui-divider p-4">
          <div>
            <div className="text-[13px] font-semibold text-ui-heading">Results</div>
            <div className="text-[11px] text-ui-text-secondary">Copy these from the platform’s insights. Leave a box empty if the number isn’t available.</div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {POST_METRICS.map(m => (
              <Field key={m} label={METRIC_LABEL[m]} htmlFor={`post-${m}`}>
                <Input id={`post-${m}`} type="number" min={0} step={1} inputMode="numeric" value={form[m]} onChange={e => onChange({ [m]: e.target.value })} />
              </Field>
            ))}
          </div>
        </div>
      )}
      <Field label="Notes" htmlFor="post-notes">
        <Textarea id="post-notes" rows={3} value={form.notes} onChange={e => onChange({ notes: e.target.value })} />
      </Field>
    </fieldset>
  );
}

function FollowersDialog({ account, history, today, onClose, onSaved }: {
  account: SocialAccountRow; history: FollowerStatRow[]; today: string | null; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState(today ?? '');
  const [followers, setFollowers] = useState('');
  const [saving, setSaving] = useState(false);
  const recent = [...history].sort((a, b) => b.recorded_on.localeCompare(a.recorded_on)).slice(0, 8);

  async function save() {
    if (!date || followers === '') { toast.error('Enter the date and the follower count'); return; }
    setSaving(true);
    try {
      await sendJson(`/api/marketing/social/accounts/${account.id}/stats`, 'POST', { recorded_on: date, followers: Number(followers) });
      toast.success('Follower count saved');
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        title="Record followers"
        description={`${platformLabel(account.platform)} · ${account.handle}`}
        footer={(
          <>
            <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
            <Button loading={saving} onClick={save}>Save count</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" htmlFor="fol-date">
              <Input id="fol-date" type="date" max={today ?? undefined} value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Followers" htmlFor="fol-count">
              <Input id="fol-count" type="number" min={0} step={1} inputMode="numeric" value={followers} onChange={e => setFollowers(e.target.value)} />
            </Field>
          </div>
          <p className="m-0 text-[11px] text-ui-text-secondary">Saving a date that already has a count replaces that day’s number.</p>
          {recent.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-ui-body">Recent counts</div>
              <ul className="m-0 flex list-none flex-col divide-y divide-ui-divider rounded-[8px] border border-ui-divider p-0">
                {recent.map((s, i) => {
                  const prev = recent[i + 1];
                  const diff = prev ? s.followers - prev.followers : null;
                  return (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2 text-[12px]">
                      <span className="text-ui-text-secondary">{fmtDay(s.recorded_on)}</span>
                      <span className="tabular-nums text-ui-heading">
                        {fmtNumber(s.followers)}
                        {diff !== null && diff !== 0 && <span className={cn('ml-2 text-[11px]', diff > 0 ? 'text-success-dark' : 'text-error-dark')}>{diff > 0 ? '+' : ''}{fmtNumber(diff)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
