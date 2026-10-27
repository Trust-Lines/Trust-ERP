import { getJson, num, postForm, qs, requestJson, toDay } from '@/lib/social/http';
import type { DiscoveredAccount, Provider, ProviderTokens, SyncedPost } from '@/lib/social/types';

// LinkedIn Community Management API — company pages the connecting user administers.
// Needs a LinkedIn app with the "Community Management API" product approved.
// Versioned REST API: every call sends LinkedIn-Version (YYYYMM, supported ~1 year), set
// LINKEDIN_API_VERSION to move it forward without a code change.
// Docs: learn.microsoft.com/linkedin/marketing/community-management

const REST = 'https://api.linkedin.com/rest';
const SCOPES = ['r_organization_social', 'w_organization_social', 'rw_organization_admin'];

const clientId = () => process.env.LINKEDIN_CLIENT_ID ?? '';
const clientSecret = () => process.env.LINKEDIN_CLIENT_SECRET ?? '';
const version = () => process.env.LINKEDIN_API_VERSION?.trim() || '202609';

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'LinkedIn-Version': version(),
  'X-Restli-Protocol-Version': '2.0.0',
});
const enc = encodeURIComponent;
const orgUrn = (id: string) => (id.startsWith('urn:') ? id : `urn:li:organization:${id}`);

/** LinkedIn "little text" commentary: these characters must be backslash-escaped or the post is rejected/garbled. */
export function escapeLinkedInText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, ch => `\\${ch}`);
}

interface TokenResponse { access_token: string; expires_in?: number; refresh_token?: string; scope?: string }
const toTokens = (t: TokenResponse, refreshToken?: string | null): ProviderTokens => ({
  access_token: t.access_token,
  refresh_token: t.refresh_token ?? refreshToken ?? null,
  expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
  scopes: t.scope ? t.scope.split(/[ ,]/).filter(Boolean) : SCOPES,
});

interface Stats { impressionCount?: number; uniqueImpressionsCount?: number; clickCount?: number; likeCount?: number; commentCount?: number; shareCount?: number }

async function shareStats(orgId: string, token: string, postIds: string[]): Promise<Map<string, Stats>> {
  const out = new Map<string, Stats>();
  const shares = postIds.filter(id => id.startsWith('urn:li:share:'));
  const ugc = postIds.filter(id => id.startsWith('urn:li:ugcPost:'));
  if (!shares.length && !ugc.length) return out;
  // Rest.li 2.0 list syntax: List(a,b) with each URN encoded, the brackets and commas not.
  const list = (ids: string[]) => `List(${ids.map(enc).join(',')})`;
  const params = [`q=organizationalEntity`, `organizationalEntity=${enc(orgUrn(orgId))}`];
  if (shares.length) params.push(`shares=${list(shares)}`);
  if (ugc.length) params.push(`ugcPosts=${list(ugc)}`);
  try {
    const res = await getJson<{ elements?: { share?: string; ugcPost?: string; totalShareStatistics?: Stats }[] }>(
      `${REST}/organizationalEntityShareStatistics?${params.join('&')}`, headers(token),
    );
    for (const e of res.elements ?? []) {
      const id = e.share ?? e.ugcPost;
      if (id && e.totalShareStatistics) out.set(id, e.totalShareStatistics);
    }
  } catch {
    // Statistics are a bonus — the posts and follower count still sync without them.
  }
  return out;
}

export const linkedinProvider: Provider = {
  id: 'linkedin',
  label: 'LinkedIn',
  platforms: ['linkedin'],
  envKeys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],

  authUrl(state, redirectUri) {
    return `https://www.linkedin.com/oauth/v2/authorization?${qs({
      response_type: 'code', client_id: clientId(), redirect_uri: redirectUri, state, scope: SCOPES.join(' '),
    })}`;
  },

  async exchangeCode(code, redirectUri) {
    return toTokens(await postForm<TokenResponse>('https://www.linkedin.com/oauth/v2/accessToken', {
      grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId(), client_secret: clientSecret(),
    }));
  },

  // Refresh tokens are only issued to some apps; without one the user reconnects every ~60 days.
  async refresh(refreshToken) {
    return toTokens(await postForm<TokenResponse>('https://www.linkedin.com/oauth/v2/accessToken', {
      grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId(), client_secret: clientSecret(),
    }), refreshToken);
  },

  async discover(tokens) {
    const acls = await getJson<{ elements?: { organization?: string; organizationTarget?: string }[] }>(
      `${REST}/organizationAcls?${qs({ q: 'roleAssignee', role: 'ADMINISTRATOR', state: 'APPROVED' })}`, headers(tokens.access_token),
    );
    const out: DiscoveredAccount[] = [];
    for (const a of acls.elements ?? []) {
      const urn = a.organization ?? a.organizationTarget;
      const id = urn?.split(':').pop();
      if (!id) continue;
      const org = await getJson<{ localizedName?: string; vanityName?: string }>(`${REST}/organizations/${id}`, headers(tokens.access_token))
        .catch(() => ({ localizedName: undefined, vanityName: undefined }));
      out.push({
        platform: 'linkedin', external_id: id, handle: org.localizedName ?? `Organization ${id}`,
        profile_url: org.vanityName ? `https://www.linkedin.com/company/${org.vanityName}/` : null, avatar_url: null, token: null,
      });
    }
    return out;
  },

  async snapshot(account, token) {
    const urn = orgUrn(account.external_id);
    const size = await getJson<{ firstDegreeSize?: number }>(
      `${REST}/networkSizes/${enc(urn)}?${qs({ edgeType: 'COMPANY_FOLLOWED_BY_MEMBER' })}`, headers(token),
    ).catch(() => ({ firstDegreeSize: undefined }));
    const res = await getJson<{ elements?: { id: string; commentary?: string; publishedAt?: number; createdAt?: number; lifecycleState?: string; content?: { media?: { id?: string } } }[] }>(
      `${REST}/posts?author=${enc(urn)}&q=author&count=50&sortBy=LAST_MODIFIED`, headers(token),
    );
    const elements = (res.elements ?? []).filter(p => !p.lifecycleState || p.lifecycleState === 'PUBLISHED');
    const stats = await shareStats(account.external_id, token, elements.map(p => p.id));
    const posts: SyncedPost[] = elements.map(p => {
      const s = stats.get(p.id);
      return {
        external_id: p.id,
        caption: p.commentary?.replace(/\\(.)/g, '$1') ?? null,
        published_on: toDay(p.publishedAt ?? p.createdAt),
        post_url: `https://www.linkedin.com/feed/update/${p.id}/`,
        media_url: null,
        media_type: p.content?.media?.id?.includes(':video:') ? 'video' : p.content?.media ? 'image' : 'text',
        metrics: s ? {
          impressions: num(s.impressionCount), reach: num(s.uniqueImpressionsCount), clicks: num(s.clickCount),
          likes: num(s.likeCount), comments: num(s.commentCount), shares: num(s.shareCount),
        } : {},
      };
    });
    return { followers: num(size.firstDegreeSize), posts };
  },

  publishBlocker(_platform, input) {
    if (input.media_type === 'video') return 'Video posts to LinkedIn aren’t supported yet — post the video in LinkedIn and it will sync here.';
    if (!input.caption.trim()) return 'LinkedIn posts need text.';
    return null;
  },

  async publish(account, token, input) {
    const author = orgUrn(account.external_id);
    let content: { media: { id: string } } | undefined;
    if (input.media_type === 'image' && input.media_url) {
      const init = await requestJson<{ value: { uploadUrl: string; image: string } }>(`${REST}/images?action=initializeUpload`, {
        method: 'POST', headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
      });
      const img = await fetch(input.media_url, { signal: AbortSignal.timeout(30_000) });
      if (!img.ok) throw new Error('Could not download the image to send it to LinkedIn');
      const up = await fetch(init.data.value.uploadUrl, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: await img.arrayBuffer(), signal: AbortSignal.timeout(60_000),
      });
      if (!up.ok) throw new Error(`LinkedIn refused the image upload (${up.status})`);
      content = { media: { id: init.data.value.image } };
    }
    const res = await requestJson<null>(`${REST}/posts`, {
      method: 'POST', headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author,
        commentary: escapeLinkedInText(input.caption),
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
        ...(content ? { content } : {}),
      }),
    });
    const id = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id');
    if (!id) throw new Error('LinkedIn accepted the post but returned no id');
    return { external_id: id, post_url: `https://www.linkedin.com/feed/update/${id}/` };
  },
};
