import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { appBaseUrl } from '@/lib/env/appUrl';
import { encryptToken } from '@/lib/crypto/secrets';
import { exchangeGoogleCode, GOOGLE_STATE_COOKIE, googleConfigured } from '@/lib/google/oauth';
import { syncGoogleCalendar } from '@/lib/google/sync';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 120;

function finish(query: string) {
  const res = NextResponse.redirect(`${appBaseUrl()}/settings?${query}`);
  res.cookies.set(GOOGLE_STATE_COOKIE, '', { maxAge: 0, path: '/api/me/google' });
  return res;
}
const fail = (m: string) => finish(`googleError=${encodeURIComponent(m)}`);

function sameState(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Google sends the person back here: store their (encrypted) tokens and run a first sync.
export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.redirect(`${appBaseUrl()}/login`);
  if (!googleConfigured()) return fail('Google isn’t set up on the server yet');

  const url = new URL(req.url);
  const denied = url.searchParams.get('error');
  if (denied) return fail(denied === 'access_denied' ? 'Google access wasn’t allowed' : `Google said: ${denied}`);
  const code = url.searchParams.get('code');
  const cookie = req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? '';
  if (!code || !cookie.startsWith(`${user.id}.`) || !sameState(cookie.slice(user.id.length + 1), url.searchParams.get('state') ?? '')) {
    return fail('The connection link expired or was opened in another browser — please try again');
  }

  const admin = createAdminClient() as any;
  try {
    const t = await exchangeGoogleCode(code);
    if (!t.scopes.some(s => s.includes('calendar'))) return fail('Calendar access wasn’t allowed — connect again and tick “See, edit, create and delete Google Calendar events”.');
    const { data: before } = await admin.from('user_google_connections').select('refresh_token_enc').eq('user_id', user.id).maybeSingle();
    const { error } = await admin.from('user_google_connections').upsert({
      user_id: user.id, google_email: t.email,
      access_token_enc: encryptToken(t.access_token),
      // Google only returns a refresh token on the first consent; keep the stored one otherwise.
      refresh_token_enc: t.refresh_token ? encryptToken(t.refresh_token) : before?.refresh_token_enc ?? null,
      token_expires_at: t.expires_at, scopes: t.scopes, last_error: null,
    }, { onConflict: 'user_id' });
    if (error) {
      console.error('[google connect]', error.message);
      return fail('Could not save the connection (is migration 130 applied?)');
    }
    await logAudit({ actorId: user.id, action: 'google.connected', resource: `user:${user.id}`, newValue: { email: t.email, scopes: t.scopes } });
    const s = await syncGoogleCalendar(admin, user.id).catch(() => null);
    return finish(`google=connected&events=${s?.events ?? 0}`);
  } catch (e) {
    console.error('[google connect]', e instanceof Error ? e.message : e);
    return fail(`Could not connect Google: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
}
