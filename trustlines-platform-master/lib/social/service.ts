import { platformLabel, POST_METRICS } from '@/lib/marketing/prWorkspace';
import { PlatformError, titleFromCaption } from '@/lib/social/http';
import { providerById, providerForPlatform } from '@/lib/social/providers';
import { decryptToken, encryptToken } from '@/lib/crypto/secrets';
import type { AccountRef, DiscoveredAccount, ProviderId, ProviderTokens, PublishInput } from '@/lib/social/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Everything that talks to a platform on the team's behalf: saving a login, attaching the
// accounts it can manage, syncing followers + post results, and publishing posts.
// Service-role client only — callers check the user's role first (or are the cron).

const today = () => new Date().toISOString().slice(0, 10);
const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

interface ConnectionRow {
  id: string; provider: ProviderId; access_token_enc: string; refresh_token_enc: string | null; token_expires_at: string | null; revoked_at: string | null;
}
interface SyncAccountRow {
  id: string; platform: string; handle: string; external_id: string | null; external_token_enc: string | null;
  connection_id: string | null; is_active: boolean;
}
const SYNC_ACCOUNT_COLS = 'id, platform, handle, external_id, external_token_enc, connection_id, is_active';

/** Stores a new login for a provider; an older login for the same provider is retired. */
export async function saveConnection(admin: any, provider: ProviderId, tokens: ProviderTokens, userId: string): Promise<string> {
  const now = new Date().toISOString();
  const { error: revokeError } = await admin.from('social_connections').update({ revoked_at: now })
    .eq('provider', provider).is('revoked_at', null);
  if (revokeError) throw new Error(`Could not update the previous connection: ${revokeError.message}`);
  const { data, error } = await admin.from('social_connections').insert({
    provider,
    external_user_id: tokens.user_id ?? null,
    external_user_name: tokens.user_name ?? null,
    access_token_enc: encryptToken(tokens.access_token),
    refresh_token_enc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    token_expires_at: tokens.expires_at ?? null,
    scopes: tokens.scopes,
    connected_by: userId,
  }).select('id').single();
  if (error) throw new Error(`Could not save the connection: ${error.message}`);
  return data.id as string;
}

/**
 * Links each discovered account to the connection. An account already known by its platform id
 * is updated (and restored if it had been removed); otherwise a manually added account with the
 * same handle is taken over, so its follower history and posts carry on; otherwise it's created.
 */
export async function attachAccounts(admin: any, connectionId: string, found: DiscoveredAccount[], userId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const a of found) {
    const linked = {
      connection_id: connectionId, external_id: a.external_id, handle: a.handle,
      profile_url: a.profile_url, avatar_url: a.avatar_url,
      external_token_enc: a.token ? encryptToken(a.token) : null,
      deleted_at: null, sync_error: null,
    };
    const { data: byExternal } = await admin.from('social_accounts').select('id')
      .eq('platform', a.platform).eq('external_id', a.external_id).maybeSingle();
    let target: string | null = byExternal?.id ?? null;
    if (!target) {
      const { data: manual } = await admin.from('social_accounts').select('id')
        .eq('platform', a.platform).is('external_id', null).is('deleted_at', null).ilike('handle', a.handle.replace(/[%_\\]/g, '\\$&')).limit(1);
      target = manual?.[0]?.id ?? null;
    }
    if (target) {
      const { error } = await admin.from('social_accounts').update(linked).eq('id', target);
      if (error) throw new Error(`Could not link ${a.handle}: ${error.message}`);
      ids.push(target);
    } else {
      const { data, error } = await admin.from('social_accounts')
        .insert({ ...linked, platform: a.platform, is_active: true, created_by: userId }).select('id').single();
      if (error) throw new Error(`Could not add ${a.handle}: ${error.message}`);
      ids.push(data.id);
    }
  }
  return ids;
}

/** The token to call the platform with for this account, renewing an expired one when possible. */
async function tokenFor(admin: any, account: SyncAccountRow): Promise<string> {
  if (account.external_token_enc) return decryptToken(account.external_token_enc);
  if (!account.connection_id) throw new Error('This account isn’t connected');
  const { data: conn, error } = await admin.from('social_connections')
    .select('id, provider, access_token_enc, refresh_token_enc, token_expires_at, revoked_at').eq('id', account.connection_id).maybeSingle() as { data: ConnectionRow | null; error: { message: string } | null };
  if (error) throw new Error(error.message);
  if (!conn || conn.revoked_at) throw new Error('The connection was removed — connect the account again');

  const expiresSoon = conn.token_expires_at && new Date(conn.token_expires_at).getTime() < Date.now() + 5 * 60_000;
  if (!expiresSoon) return decryptToken(conn.access_token_enc);

  const provider = providerById(conn.provider);
  if (!provider?.refresh || !conn.refresh_token_enc) throw new Error('The login has expired — a manager needs to connect the account again');
  const fresh = await provider.refresh(decryptToken(conn.refresh_token_enc));
  await admin.from('social_connections').update({
    access_token_enc: encryptToken(fresh.access_token),
    refresh_token_enc: fresh.refresh_token ? encryptToken(fresh.refresh_token) : conn.refresh_token_enc,
    token_expires_at: fresh.expires_at ?? null,
    last_error: null,
  }).eq('id', conn.id);
  return fresh.access_token;
}

const refOf = (a: SyncAccountRow): AccountRef => ({ id: a.id, platform: a.platform, external_id: a.external_id!, handle: a.handle });

export interface SyncResult { accountId: string; handle: string; ok: boolean; posts?: number; error?: string }

/** Pulls followers and the latest posts (with their results) for one connected account. */
export async function syncAccount(admin: any, account: SyncAccountRow): Promise<SyncResult> {
  const provider = providerForPlatform(account.platform);
  try {
    if (!provider || !account.external_id) throw new Error('This account isn’t connected to its platform');
    const snap = await provider.snapshot(refOf(account), await tokenFor(admin, account));
    const now = new Date().toISOString();

    if (snap.followers !== null) {
      const { error } = await admin.from('social_account_stats')
        .upsert({ account_id: account.id, recorded_on: today(), followers: snap.followers }, { onConflict: 'account_id,recorded_on' });
      if (error) throw new Error(`Could not save the follower count: ${error.message}`);
    }

    const externalIds = snap.posts.map(p => p.external_id);
    const { data: existing, error: readError } = externalIds.length
      ? await admin.from('social_posts').select('id, external_id, deleted_at').eq('account_id', account.id).in('external_id', externalIds)
      : { data: [], error: null };
    if (readError) throw new Error(readError.message);
    const known = new Map(((existing ?? []) as { id: string; external_id: string; deleted_at: string | null }[]).map(r => [r.external_id, r]));

    for (const p of snap.posts) {
      // Only overwrite a number the platform actually returned — a manual figure survives a gap.
      const metrics = Object.fromEntries(POST_METRICS.filter(m => p.metrics[m] !== null && p.metrics[m] !== undefined).map(m => [m, p.metrics[m]]));
      const row = known.get(p.external_id);
      if (row) {
        if (row.deleted_at) continue; // the team deleted it here; don't bring it back
        const { error } = await admin.from('social_posts').update({
          ...metrics, post_url: p.post_url, media_url: p.media_url, published_on: p.published_on, last_synced_at: now,
        }).eq('id', row.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await admin.from('social_posts').insert({
          account_id: account.id, external_id: p.external_id, source: 'synced', status: 'published',
          title: titleFromCaption(p.caption, `${platformLabel(account.platform)} post`), caption: p.caption,
          published_on: p.published_on, post_url: p.post_url, media_url: p.media_url, media_type: p.media_type,
          last_synced_at: now, ...metrics,
        });
        if (error) throw new Error(error.message);
      }
    }

    await admin.from('social_accounts').update({
      last_synced_at: now, sync_error: null,
      ...(snap.handle ? { handle: snap.handle } : {}), ...(snap.avatar_url ? { avatar_url: snap.avatar_url } : {}),
    }).eq('id', account.id);
    return { accountId: account.id, handle: account.handle, ok: true, posts: snap.posts.length };
  } catch (e) {
    const message = short(e);
    console.error(`[social sync] ${account.platform}/${account.handle}:`, message);
    await admin.from('social_accounts').update({ sync_error: message }).eq('id', account.id);
    return { accountId: account.id, handle: account.handle, ok: false, error: message };
  }
}

/** Syncs every connected, active account (or just one). */
export async function syncAccounts(admin: any, accountId?: string): Promise<SyncResult[]> {
  let q = admin.from('social_accounts').select(SYNC_ACCOUNT_COLS)
    .is('deleted_at', null).eq('is_active', true).not('connection_id', 'is', null).not('external_id', 'is', null);
  if (accountId) q = q.eq('id', accountId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const results: SyncResult[] = [];
  for (const a of (data ?? []) as SyncAccountRow[]) results.push(await syncAccount(admin, a));
  return results;
}

export class PublishError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

interface PostForPublish {
  id: string; account_id: string | null; caption: string | null; title: string; media_url: string | null; media_type: 'image' | 'video' | 'text' | null;
}

/** Why a post can't go out automatically (shown in the editor), or null when it can. */
export async function publishBlockerFor(admin: any, post: Omit<PostForPublish, 'id' | 'title'>): Promise<string | null> {
  if (!post.account_id) return 'Pick an account to publish to.';
  const { data: account } = await admin.from('social_accounts').select(SYNC_ACCOUNT_COLS).eq('id', post.account_id).is('deleted_at', null).maybeSingle();
  if (!account) return 'The account no longer exists.';
  if (!account.connection_id || !account.external_id) return 'This account isn’t connected — connect it to publish from here.';
  const provider = providerForPlatform(account.platform);
  if (!provider?.publish) return `${platformLabel(account.platform)} doesn’t support publishing from here.`;
  return provider.publishBlocker(account.platform, inputOf(post));
}

const inputOf = (p: Pick<PostForPublish, 'caption' | 'media_url' | 'media_type'>): PublishInput => ({
  caption: p.caption ?? '',
  media_url: p.media_url,
  media_type: p.media_type ?? (p.media_url ? 'image' : 'text'),
});

/**
 * Publishes one post now. The row is claimed first (status → publishing) so a second click or
 * an overlapping cron run can never post the same thing twice.
 */
export async function publishPost(admin: any, postId: string, fromStatuses: string[] = ['idea', 'draft', 'scheduled', 'failed']) {
  const { data: post, error: claimError } = await admin.from('social_posts')
    .update({ status: 'publishing', publish_error: null })
    .eq('id', postId).is('deleted_at', null).is('external_id', null).in('status', fromStatuses)
    .select('id, account_id, caption, title, media_url, media_type').maybeSingle() as { data: PostForPublish | null; error: { message: string } | null };
  if (claimError) throw new PublishError('Could not start publishing', 500);
  if (!post) throw new PublishError('This post is already published or being published', 409);

  const fail = async (message: string) => {
    await admin.from('social_posts').update({ status: 'failed', publish_error: message.slice(0, 500) }).eq('id', post.id);
    return { ok: false as const, error: message };
  };

  const blocker = await publishBlockerFor(admin, post);
  if (blocker) return fail(blocker);

  const { data: account } = await admin.from('social_accounts').select(SYNC_ACCOUNT_COLS).eq('id', post.account_id).maybeSingle();
  const provider = providerForPlatform(account.platform)!;
  try {
    const token = await tokenFor(admin, account);
    const result = await provider.publish!(refOf(account), token, inputOf(post));
    await admin.from('social_posts').update({
      status: 'published', source: 'erp', external_id: result.external_id, post_url: result.post_url,
      published_on: today(), scheduled_at: null, publish_error: null,
    }).eq('id', post.id);
    return { ok: true as const, post_url: result.post_url };
  } catch (e) {
    const prefix = e instanceof PlatformError ? `${platformLabel(account.platform)} said: ` : '';
    return fail(prefix + short(e));
  }
}

/** Cron: publishes every scheduled post whose time has come. */
export async function publishDuePosts(admin: any) {
  const now = new Date().toISOString();

  // A publish that died half-way (timeout, deploy) is marked failed rather than retried: the
  // platform may already have the post, and a blind retry could post it twice.
  const stale = new Date(Date.now() - 15 * 60_000).toISOString();
  await admin.from('social_posts').update({ status: 'failed', publish_error: 'Publishing was interrupted — check the platform before trying again.' })
    .eq('status', 'publishing').lt('updated_at', stale);

  const { data, error } = await admin.from('social_posts').select('id')
    .eq('status', 'scheduled').is('deleted_at', null).is('external_id', null).not('scheduled_at', 'is', null).lte('scheduled_at', now)
    .order('scheduled_at').limit(20);
  if (error) throw new Error(error.message);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const { id } of (data ?? []) as { id: string }[]) {
    try {
      const r = await publishPost(admin, id, ['scheduled']);
      results.push({ id, ok: r.ok, error: r.ok ? undefined : r.error });
    } catch (e) {
      results.push({ id, ok: false, error: short(e) });
    }
  }
  return results;
}
