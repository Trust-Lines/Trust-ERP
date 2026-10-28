import type { PostMetric } from '@/lib/marketing/prWorkspace';

export type ProviderId = 'meta' | 'google' | 'linkedin';

/** Tokens returned by a provider's OAuth code exchange or refresh. */
export interface ProviderTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  scopes: string[];
  user_id?: string | null;
  user_name?: string | null;
}

/** An account the connected login can manage (a Facebook Page, an Instagram account, …). */
export interface DiscoveredAccount {
  platform: 'instagram' | 'facebook' | 'youtube' | 'linkedin';
  external_id: string;
  handle: string;
  profile_url: string | null;
  avatar_url: string | null;
  /** The account's own token when the platform has one (Facebook Page token). */
  token: string | null;
}

export interface SyncedPost {
  external_id: string;
  caption: string | null;
  published_on: string | null;
  post_url: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | 'text' | null;
  metrics: Partial<Record<PostMetric, number | null>>;
}

export interface AccountSnapshot {
  followers: number | null;
  handle?: string;
  avatar_url?: string | null;
  posts: SyncedPost[];
}

/** What the provider code needs to know about a stored account. */
export interface AccountRef {
  id: string;
  platform: string;
  external_id: string;
  handle: string;
}

export interface PublishInput {
  caption: string;
  media_url: string | null;
  media_type: 'image' | 'video' | 'text' | null;
}

export interface Provider {
  id: ProviderId;
  label: string;
  platforms: DiscoveredAccount['platform'][];
  /** Env vars that must be set for this provider to be offered. */
  envKeys: string[];
  authUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<ProviderTokens>;
  /** Only for providers whose access token expires and can be renewed without the user. */
  refresh?(refreshToken: string): Promise<ProviderTokens>;
  discover(tokens: ProviderTokens): Promise<DiscoveredAccount[]>;
  snapshot(account: AccountRef, token: string): Promise<AccountSnapshot>;
  /** Why this post can't be published automatically, or null when it can. */
  publishBlocker(platform: string, input: PublishInput): string | null;
  publish?(account: AccountRef, token: string, input: PublishInput): Promise<{ external_id: string; post_url: string | null }>;
}
