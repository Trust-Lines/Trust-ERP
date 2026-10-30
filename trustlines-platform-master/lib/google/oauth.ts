import { appBaseUrl } from '@/lib/env/appUrl';
import { decryptToken, encryptToken, tokenKeyConfigured } from '@/lib/crypto/secrets';
import { getJson, postForm, qs } from '@/lib/social/http';

/* eslint-disable @typescript-eslint/no-explicit-any */

// A person's own Google account (Settings → Google account): Calendar events (read + create
// with Meet) and Meet recordings/transcripts. Same Google Cloud OAuth client as YouTube
// (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET); this flow has its own redirect URI.

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/meetings.space.readonly',
];

export const GOOGLE_STATE_COOKIE = 'google_oauth_state';

const clientId = () => process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '';

export const googleConfigured = () => tokenKeyConfigured() && !!clientId() && !!clientSecret();
export const googleRedirectUri = () => `${appBaseUrl()}/api/me/google/callback`;

export function googleAuthUrl(state: string): string {
  return `https://accounts.google.com/o/oauth2/v2/auth?${qs({
    client_id: clientId(), redirect_uri: googleRedirectUri(), response_type: 'code', scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  })}`;
}

interface TokenResponse { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string }

export async function exchangeGoogleCode(code: string) {
  const t = await postForm<TokenResponse>('https://oauth2.googleapis.com/token', {
    code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: googleRedirectUri(), grant_type: 'authorization_code',
  });
  const me = await getJson<{ email?: string }>('https://openidconnect.googleapis.com/v1/userinfo', { Authorization: `Bearer ${t.access_token}` });
  if (!me.email) throw new Error('Google did not share the account’s email address');
  return {
    email: me.email.toLowerCase(),
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? null,
    expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
    scopes: t.scope ? t.scope.split(' ') : GOOGLE_SCOPES,
  };
}

export class GoogleNotConnected extends Error {}

interface ConnRow { user_id: string; google_email: string; access_token_enc: string; refresh_token_enc: string | null; token_expires_at: string | null; scopes: string[] }

/** A working access token for the person, refreshed (and stored) when it's about to expire. */
export async function googleTokenFor(admin: any, userId: string): Promise<{ token: string; email: string; scopes: string[] }> {
  const { data: c, error } = await admin.from('user_google_connections')
    .select('user_id, google_email, access_token_enc, refresh_token_enc, token_expires_at, scopes').eq('user_id', userId).maybeSingle() as { data: ConnRow | null; error: { message: string } | null };
  if (error) throw new Error(error.message);
  if (!c) throw new GoogleNotConnected('Connect your Google account first: Settings → Google account.');

  let token: string;
  try {
    const fresh = c.token_expires_at && new Date(c.token_expires_at).getTime() > Date.now() + 2 * 60_000;
    if (fresh) return { token: decryptToken(c.access_token_enc), email: c.google_email, scopes: c.scopes };
    if (!c.refresh_token_enc) throw new GoogleNotConnected('Your Google connection expired — connect it again in Settings → Google account.');
    const t = await postForm<TokenResponse>('https://oauth2.googleapis.com/token', {
      refresh_token: decryptToken(c.refresh_token_enc), client_id: clientId(), client_secret: clientSecret(), grant_type: 'refresh_token',
    });
    token = t.access_token;
    await admin.from('user_google_connections').update({
      access_token_enc: encryptToken(t.access_token),
      token_expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
      last_error: null,
    }).eq('user_id', userId);
  } catch (e) {
    if (e instanceof GoogleNotConnected) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    // invalid_grant = the person revoked access or changed their password: they must reconnect.
    if (/invalid_grant|revoked|expired/i.test(msg)) throw new GoogleNotConnected('Google access was revoked or expired — connect it again in Settings → Google account.');
    if (/decrypt|authenticate data|Stored token/i.test(msg)) throw new GoogleNotConnected('Your saved Google connection can’t be read (encryption key changed) — connect it again in Settings → Google account.');
    throw e;
  }
  return { token, email: c.google_email, scopes: c.scopes };
}
