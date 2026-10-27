import { appBaseUrl } from '@/lib/env/appUrl';
import { tokenKeyConfigured } from '@/lib/social/tokenCrypto';
import type { Provider, ProviderId } from '@/lib/social/types';
import { metaProvider } from './meta';
import { youtubeProvider } from './youtube';
import { linkedinProvider } from './linkedin';

export const PROVIDERS: Record<ProviderId, Provider> = { meta: metaProvider, google: youtubeProvider, linkedin: linkedinProvider };

export function providerById(id: string): Provider | null {
  return (PROVIDERS as Record<string, Provider>)[id] ?? null;
}

export function providerForPlatform(platform: string): Provider | null {
  return Object.values(PROVIDERS).find(p => p.platforms.includes(platform as never)) ?? null;
}

/** A provider is offered once its app credentials and the token encryption key are set. */
export function providerConfigured(p: Provider): boolean {
  return tokenKeyConfigured() && p.envKeys.every(k => !!process.env[k]?.trim());
}

/** The OAuth redirect URI to register in each platform's developer app. */
export function callbackUrl(id: ProviderId): string {
  return `${appBaseUrl()}/api/marketing/social/callback/${id}`;
}

export interface ProviderStatus { id: ProviderId; label: string; configured: boolean; missing: string[] }

export function providerStatuses(): ProviderStatus[] {
  return Object.values(PROVIDERS).map(p => ({
    id: p.id,
    label: p.label,
    configured: providerConfigured(p),
    missing: [...(tokenKeyConfigured() ? [] : ['SOCIAL_TOKEN_KEY']), ...p.envKeys.filter(k => !process.env[k]?.trim())],
  }));
}

/** Short-lived httpOnly cookie holding the OAuth state between "Connect" and the callback. */
export const OAUTH_STATE_COOKIE = 'social_oauth_state';
