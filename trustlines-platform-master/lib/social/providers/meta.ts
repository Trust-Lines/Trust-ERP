import { getJson, num, postForm, qs, toDay, PlatformError } from '@/lib/social/http';
import type { AccountRef, AccountSnapshot, DiscoveredAccount, Provider, ProviderTokens, PublishInput, SyncedPost } from '@/lib/social/types';

// Meta Graph API — Facebook Pages and the Instagram Business/Creator accounts linked to them.
// One "Facebook Login" gives a user token; /me/accounts returns each Page with its own Page
// token (non-expiring when obtained from a long-lived user token), which is also the token
// Instagram's Graph API calls for that Page's Instagram account use.
// Docs: developers.facebook.com/docs/instagram-platform , /docs/pages-api

const VERSION = () => process.env.META_GRAPH_VERSION?.trim() || 'v23.0';
const GRAPH = () => `https://graph.facebook.com/${VERSION()}`;

const SCOPES = [
  'pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'read_insights', 'business_management',
  'instagram_basic', 'instagram_manage_insights', 'instagram_content_publish',
];

/** Posts per account whose insights are fetched on each sync (one Graph call each). */
const INSIGHT_POSTS = 25;

const appId = () => process.env.META_APP_ID ?? '';
const appSecret = () => process.env.META_APP_SECRET ?? '';

/** Instagram only accepts JPEG images; ImageKit converts on the fly. */
export function instagramImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname !== 'ik.imagekit.io') return url;
    u.searchParams.set('tr', [u.searchParams.get('tr'), 'f-jpg'].filter(Boolean).join(','));
    return u.toString();
  } catch {
    return url;
  }
}

interface GraphList<T> { data: T[] }
interface PageRow {
  id: string; name: string; link?: string; access_token: string; picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
}

async function insights(id: string, token: string, metricSets: string[][]): Promise<Record<string, number | null>> {
  for (const metrics of metricSets) {
    try {
      const res = await getJson<GraphList<{ name: string; values?: { value: unknown }[]; total_value?: { value: unknown } }>>(
        `${GRAPH()}/${id}/insights?${qs({ metric: metrics.join(','), access_token: token })}`,
      );
      return Object.fromEntries(res.data.map(m => [m.name, num(m.total_value?.value ?? m.values?.[0]?.value)]));
    } catch (e) {
      // A metric that doesn't exist for this media type / API version fails the whole call:
      // try the next, smaller set.
      if (!(e instanceof PlatformError)) throw e;
    }
  }
  return {};
}

async function instagramSnapshot(account: AccountRef, token: string): Promise<AccountSnapshot> {
  const profile = await getJson<{ username?: string; followers_count?: number; profile_picture_url?: string }>(
    `${GRAPH()}/${account.external_id}?${qs({ fields: 'username,followers_count,profile_picture_url', access_token: token })}`,
  );
  const media = await getJson<GraphList<{
    id: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string;
    permalink?: string; timestamp?: string; like_count?: number; comments_count?: number;
  }>>(`${GRAPH()}/${account.external_id}/media?${qs({
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count', limit: 50, access_token: token,
  })}`);

  const posts: SyncedPost[] = [];
  for (const [i, m] of media.data.entries()) {
    const ins = i < INSIGHT_POSTS
      ? await insights(m.id, token, [['reach', 'saved', 'shares', 'views'], ['reach', 'saved', 'shares'], ['reach']])
      : {};
    posts.push({
      external_id: m.id,
      caption: m.caption ?? null,
      published_on: toDay(m.timestamp),
      post_url: m.permalink ?? null,
      media_url: m.media_type === 'VIDEO' ? m.thumbnail_url ?? null : m.media_url ?? null,
      media_type: m.media_type === 'VIDEO' ? 'video' : 'image',
      metrics: {
        likes: num(m.like_count), comments: num(m.comments_count),
        reach: ins.reach ?? null, saves: ins.saved ?? null, shares: ins.shares ?? null, impressions: ins.views ?? null,
      },
    });
  }
  return { followers: num(profile.followers_count), handle: profile.username, avatar_url: profile.profile_picture_url ?? null, posts };
}

async function facebookSnapshot(account: AccountRef, token: string): Promise<AccountSnapshot> {
  const page = await getJson<{ name?: string; followers_count?: number; fan_count?: number; picture?: { data?: { url?: string } } }>(
    `${GRAPH()}/${account.external_id}?${qs({ fields: 'name,followers_count,fan_count,picture{url}', access_token: token })}`,
  );
  const feed = await getJson<GraphList<{
    id: string; message?: string; created_time?: string; permalink_url?: string; full_picture?: string;
    shares?: { count?: number }; reactions?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } };
    attachments?: { data?: { media_type?: string }[] };
  }>>(`${GRAPH()}/${account.external_id}/published_posts?${qs({
    fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),attachments{media_type}',
    limit: 50, access_token: token,
  })}`);

  const posts: SyncedPost[] = [];
  for (const [i, p] of feed.data.entries()) {
    const ins = i < INSIGHT_POSTS ? await insights(p.id, token, [['post_impressions', 'post_impressions_unique', 'post_clicks'], ['post_impressions_unique']]) : {};
    const kind = p.attachments?.data?.[0]?.media_type;
    posts.push({
      external_id: p.id,
      caption: p.message ?? null,
      published_on: toDay(p.created_time),
      post_url: p.permalink_url ?? null,
      media_url: p.full_picture ?? null,
      media_type: kind === 'video' ? 'video' : p.full_picture ? 'image' : 'text',
      metrics: {
        likes: num(p.reactions?.summary?.total_count), comments: num(p.comments?.summary?.total_count), shares: num(p.shares?.count ?? 0),
        impressions: ins.post_impressions ?? null, reach: ins.post_impressions_unique ?? null, clicks: ins.post_clicks ?? null,
      },
    });
  }
  return { followers: num(page.followers_count ?? page.fan_count), handle: page.name, avatar_url: page.picture?.data?.url ?? null, posts };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function publishInstagram(account: AccountRef, token: string, input: PublishInput) {
  const base = `${GRAPH()}/${account.external_id}`;
  const container = await postForm<{ id: string }>(`${base}/media`, input.media_type === 'video'
    ? { media_type: 'REELS', video_url: input.media_url!, caption: input.caption, access_token: token }
    : { image_url: instagramImageUrl(input.media_url!), caption: input.caption, access_token: token });

  // Instagram processes the media before it can be published (seconds for an image, up to a
  // couple of minutes for a video).
  for (let i = 0; i < 24; i++) {
    const s = await getJson<{ status_code?: string; status?: string }>(`${GRAPH()}/${container.id}?${qs({ fields: 'status_code,status', access_token: token })}`);
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram could not process the media: ${s.status ?? s.status_code}`);
    if (i === 23) throw new Error('Instagram is still processing the media — try “Publish now” again in a few minutes.');
    await sleep(5000);
  }

  const published = await postForm<{ id: string }>(`${base}/media_publish`, { creation_id: container.id, access_token: token });
  const info = await getJson<{ permalink?: string }>(`${GRAPH()}/${published.id}?${qs({ fields: 'permalink', access_token: token })}`).catch(() => ({ permalink: undefined }));
  return { external_id: published.id, post_url: info.permalink ?? null };
}

async function publishFacebook(account: AccountRef, token: string, input: PublishInput) {
  const base = `${GRAPH()}/${account.external_id}`;
  let postId: string;
  if (input.media_type === 'image' && input.media_url) {
    const r = await postForm<{ id: string; post_id?: string }>(`${base}/photos`, { url: input.media_url, caption: input.caption, access_token: token });
    postId = r.post_id ?? r.id;
  } else if (input.media_type === 'video' && input.media_url) {
    const r = await postForm<{ id: string }>(`${base}/videos`, { file_url: input.media_url, description: input.caption, access_token: token });
    postId = r.id;
  } else {
    const r = await postForm<{ id: string }>(`${base}/feed`, { message: input.caption, access_token: token });
    postId = r.id;
  }
  const info = await getJson<{ permalink_url?: string }>(`${GRAPH()}/${postId}?${qs({ fields: 'permalink_url', access_token: token })}`).catch(() => ({ permalink_url: undefined }));
  return { external_id: postId, post_url: info.permalink_url ?? null };
}

export const metaProvider: Provider = {
  id: 'meta',
  label: 'Instagram & Facebook',
  platforms: ['instagram', 'facebook'],
  envKeys: ['META_APP_ID', 'META_APP_SECRET'],

  authUrl(state, redirectUri) {
    return `https://www.facebook.com/${VERSION()}/dialog/oauth?${qs({
      client_id: appId(), redirect_uri: redirectUri, state, response_type: 'code', scope: SCOPES.join(','),
    })}`;
  },

  async exchangeCode(code, redirectUri): Promise<ProviderTokens> {
    const short = await getJson<{ access_token: string }>(`${GRAPH()}/oauth/access_token?${qs({
      client_id: appId(), client_secret: appSecret(), redirect_uri: redirectUri, code,
    })}`);
    // Long-lived user token (~60 days); the Page tokens derived from it don't expire.
    const long = await getJson<{ access_token: string; expires_in?: number }>(`${GRAPH()}/oauth/access_token?${qs({
      grant_type: 'fb_exchange_token', client_id: appId(), client_secret: appSecret(), fb_exchange_token: short.access_token,
    })}`);
    const me = await getJson<{ id: string; name?: string }>(`${GRAPH()}/me?${qs({ fields: 'id,name', access_token: long.access_token })}`);
    const perms = await getJson<GraphList<{ permission: string; status: string }>>(`${GRAPH()}/me/permissions?${qs({ access_token: long.access_token })}`)
      .catch(() => ({ data: [] }));
    return {
      access_token: long.access_token,
      expires_at: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null,
      scopes: perms.data.filter(p => p.status === 'granted').map(p => p.permission),
      user_id: me.id, user_name: me.name ?? null,
    };
  },

  async discover(tokens) {
    const pages = await getJson<GraphList<PageRow>>(`${GRAPH()}/me/accounts?${qs({
      fields: 'id,name,link,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}', limit: 100,
      access_token: tokens.access_token,
    })}`);
    const out: DiscoveredAccount[] = [];
    for (const p of pages.data) {
      out.push({ platform: 'facebook', external_id: p.id, handle: p.name, profile_url: p.link ?? `https://www.facebook.com/${p.id}`, avatar_url: p.picture?.data?.url ?? null, token: p.access_token });
      const ig = p.instagram_business_account;
      if (ig) {
        out.push({
          platform: 'instagram', external_id: ig.id, handle: ig.username ?? p.name,
          profile_url: ig.username ? `https://www.instagram.com/${ig.username}/` : null, avatar_url: ig.profile_picture_url ?? null, token: p.access_token,
        });
      }
    }
    return out;
  },

  snapshot(account, token) {
    return account.platform === 'instagram' ? instagramSnapshot(account, token) : facebookSnapshot(account, token);
  },

  publishBlocker(platform, input) {
    if (platform === 'instagram' && (!input.media_url || input.media_type === 'text')) return 'Instagram posts need an image or a video.';
    if (!input.caption.trim() && !input.media_url) return 'Add a caption or media to publish.';
    return null;
  },

  publish(account, token, input) {
    return account.platform === 'instagram' ? publishInstagram(account, token, input) : publishFacebook(account, token, input);
  },
};
