'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { engagementRate } from '@/lib/marketing/prWorkspace';
import type { CampaignOption, FollowerStatRow, SocialConnectionRow, SocialPostRow } from '@/lib/marketing/prWorkspaceServer';
import { sendJson } from '@/components/platform/marketing/pr/shared';
import { EMPTY_DATA, postBody, type AccountEdit, type DeleteTarget, type PostEdit, type SocialData } from './socialForms';

/**
 * Social data (accounts, posts, follower stats, platform connections), lookups, KPIs and every write.
 * Each write reloads the whole set afterwards. Writes that take a `close` callback call it on success,
 * before the reload; disconnect / delete rethrow on failure so their confirm dialog stays open.
 */
export function useSocialData(initial: SocialData | null, campaigns: CampaignOption[], today: string | null) {
  const [data, setData] = useState<SocialData>(initial ?? EMPTY_DATA);
  const [syncing, setSyncing] = useState<string | null>(null); // 'all' or an account id
  const [publishing, setPublishing] = useState(false);

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

  // Follower totals don't depend on the date; the post counts and engagement do, so they wait for `today`.
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

  /** Returns the saved post's id, or null when validation or the request failed. */
  async function savePost(edit: PostEdit, close: () => void): Promise<string | null> {
    const { id, form } = edit;
    if (!form.title.trim()) { toast.error('Title is required'); return null; }
    if (form.status === 'scheduled' && form.scheduled_at && new Date(form.scheduled_at).getTime() < Date.now() - 60_000) {
      toast.error('The publish time is in the past — pick a later time or use “Publish now”.');
      return null;
    }
    try {
      const res = await sendJson<{ post: SocialPostRow }>(id ? `/api/marketing/social/posts/${id}` : '/api/marketing/social/posts', id ? 'PATCH' : 'POST', postBody(form));
      toast.success(id ? 'Post saved' : 'Post added');
      close();
      await reload();
      return res.post.id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the post');
      return null;
    }
  }

  // Saves the editor first (so what goes out is what's on screen), then publishes.
  async function publishNow(edit: PostEdit, close: () => void) {
    setPublishing(true);
    try {
      const id = await savePost(edit, close);
      if (!id) return;
      const res = await sendJson<{ post_url: string | null }>(`/api/marketing/social/posts/${id}/publish`, 'POST');
      toast.success('Published', res.post_url ? { action: { label: 'Open', onClick: () => window.open(res.post_url!, '_blank', 'noopener') } } : undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not publish', { duration: 10_000 });
    } finally {
      setPublishing(false);
      await reload();
    }
  }

  /** One account, or every connected account when no id is given. */
  async function syncNow(accountId?: string) {
    setSyncing(accountId ?? 'all');
    try {
      const { results } = await sendJson<{ results: { ok: boolean; handle: string; error?: string }[] }>('/api/marketing/social/sync', 'POST', accountId ? { accountId } : {});
      const failed = results.filter(r => !r.ok);
      if (!results.length) toast.info('No connected account to sync yet');
      else if (failed.length) toast.error(`${failed.length} of ${results.length} could not sync: ${failed[0].handle} — ${failed[0].error}`, { duration: 10_000 });
      else toast.success(`Synced ${results.length} account${results.length === 1 ? '' : 's'}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not sync');
    } finally {
      setSyncing(null);
    }
  }

  async function disconnect(conn: SocialConnectionRow, close: () => void) {
    try {
      await sendJson(`/api/marketing/social/connections/${conn.id}`, 'DELETE');
      toast.success('Disconnected — the accounts and their history stay, as manual accounts');
      close();
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not disconnect');
      throw e;
    }
  }

  async function saveAccount(edit: AccountEdit, close: () => void) {
    const { id, form } = edit;
    if (!form.platform || !form.handle.trim()) { toast.error('Pick a platform and enter the account name'); return; }
    try {
      await sendJson(id ? `/api/marketing/social/accounts/${id}` : '/api/marketing/social/accounts', id ? 'PATCH' : 'POST', form);
      toast.success(id ? 'Account saved' : 'Account added');
      close();
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the account');
    }
  }

  async function remove(target: DeleteTarget, close: () => void) {
    try {
      await sendJson(`/api/marketing/social/${target.kind === 'post' ? 'posts' : 'accounts'}/${target.id}`, 'DELETE');
      toast.success(target.kind === 'post' ? 'Post deleted' : 'Account removed');
      close();
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
      throw e; // keeps the dialog open
    }
  }

  return {
    data, reload, accountById, campaignById, statsByAccount, kpis,
    connectedCount: data.accounts.filter(a => a.connection_id).length,
    syncing, publishing,
    savePost, publishNow, syncNow, disconnect, saveAccount, remove,
  };
}

export type SocialStore = ReturnType<typeof useSocialData>;
