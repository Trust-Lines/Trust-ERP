import { getJson, num, postForm, qs, toDay } from '@/lib/social/http';
import type { Provider, ProviderTokens, SyncedPost } from '@/lib/social/types';

// YouTube Data API v3 through Google OAuth. Read-only: subscribers and each video's views,
// likes and comments. Videos are still uploaded in YouTube Studio (an upload from the ERP
// would mean moving large video files through the server).

const API = 'https://www.googleapis.com/youtube/v3';
const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];

const clientId = () => process.env.GOOGLE_CLIENT_ID ?? '';
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET ?? '';

interface TokenResponse { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }

const toTokens = (t: TokenResponse, refreshToken?: string | null): ProviderTokens => ({
  access_token: t.access_token,
  refresh_token: t.refresh_token ?? refreshToken ?? null,
  expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
  scopes: t.scope ? t.scope.split(' ') : SCOPES,
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const youtubeProvider: Provider = {
  id: 'google',
  label: 'YouTube',
  platforms: ['youtube'],
  envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],

  authUrl(state, redirectUri) {
    return `https://accounts.google.com/o/oauth2/v2/auth?${qs({
      client_id: clientId(), redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '),
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
    })}`;
  },

  async exchangeCode(code, redirectUri) {
    const t = await postForm<TokenResponse>('https://oauth2.googleapis.com/token', {
      code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: redirectUri, grant_type: 'authorization_code',
    });
    return toTokens(t);
  },

  async refresh(refreshToken) {
    const t = await postForm<TokenResponse>('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken, client_id: clientId(), client_secret: clientSecret(), grant_type: 'refresh_token',
    });
    return toTokens(t, refreshToken);
  },

  async discover(tokens) {
    const res = await getJson<{ items?: { id: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } } }[] }>(
      `${API}/channels?${qs({ part: 'snippet', mine: 'true' })}`, auth(tokens.access_token),
    );
    return (res.items ?? []).map(c => ({
      platform: 'youtube' as const,
      external_id: c.id,
      handle: c.snippet?.customUrl || c.snippet?.title || c.id,
      profile_url: `https://www.youtube.com/channel/${c.id}`,
      avatar_url: c.snippet?.thumbnails?.default?.url ?? null,
      token: null,
    }));
  },

  async snapshot(account, token) {
    const ch = await getJson<{ items?: { statistics?: { subscriberCount?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } }; snippet?: { thumbnails?: { default?: { url?: string } } } }[] }>(
      `${API}/channels?${qs({ part: 'statistics,contentDetails,snippet', id: account.external_id })}`, auth(token),
    );
    const channel = ch.items?.[0];
    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
    const posts: SyncedPost[] = [];
    if (uploads) {
      const list = await getJson<{ items?: { contentDetails?: { videoId?: string } }[] }>(
        `${API}/playlistItems?${qs({ part: 'contentDetails', playlistId: uploads, maxResults: 50 })}`, auth(token),
      );
      const ids = (list.items ?? []).map(i => i.contentDetails?.videoId).filter((v): v is string => !!v);
      if (ids.length) {
        const videos = await getJson<{ items?: { id: string; snippet?: { title?: string; description?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>(
          `${API}/videos?${qs({ part: 'snippet,statistics', id: ids.join(',') })}`, auth(token),
        );
        for (const v of videos.items ?? []) {
          posts.push({
            external_id: v.id,
            // The video title is the post title; keep it on the first line so titleFromCaption picks it.
            caption: [v.snippet?.title, v.snippet?.description].filter(Boolean).join('\n') || null,
            published_on: toDay(v.snippet?.publishedAt),
            post_url: `https://www.youtube.com/watch?v=${v.id}`,
            media_url: v.snippet?.thumbnails?.medium?.url ?? null,
            media_type: 'video',
            metrics: { impressions: num(v.statistics?.viewCount), likes: num(v.statistics?.likeCount), comments: num(v.statistics?.commentCount) },
          });
        }
      }
    }
    return { followers: num(channel?.statistics?.subscriberCount), avatar_url: channel?.snippet?.thumbnails?.default?.url ?? null, posts };
  },

  publishBlocker() {
    return 'YouTube videos are uploaded in YouTube Studio; their results are synced here.';
  },
};
