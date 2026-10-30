import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { appBaseUrl } from '@/lib/env/appUrl';
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleConfigured } from '@/lib/google/oauth';

// Settings → Google account → "Connect": the person signs in to Google and allows Calendar +
// Meet access for THEIR OWN account. The state cookie is checked on the way back (CSRF).
export async function GET() {
  const { user } = await requireUser();
  if (!user) return NextResponse.redirect(`${appBaseUrl()}/login`);
  if (!googleConfigured()) return NextResponse.redirect(`${appBaseUrl()}/settings?googleError=${encodeURIComponent('Google isn’t set up on the server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / APP_ENCRYPTION_KEY).')}`);

  const state = randomBytes(24).toString('base64url');
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set(GOOGLE_STATE_COOKIE, `${user.id}.${state}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/api/me/google',
  });
  return res;
}
