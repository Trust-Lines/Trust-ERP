import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { appBaseUrl } from '@/lib/env/appUrl';
import { callbackUrl, OAUTH_STATE_COOKIE, providerById, providerConfigured } from '@/lib/social/providers';

type Params = { params: Promise<{ provider: string }> };

const back = (query: string) => NextResponse.redirect(`${appBaseUrl()}/marketing/social?${query}`);

// "Connect" button: sends a Marketing manager to the platform's login/consent screen. A random
// state goes into a short-lived httpOnly cookie and is checked on the way back (CSRF).
export async function GET(_req: NextRequest, { params }: Params) {
  const { provider: id } = await params;
  const { deny } = await requireRole(MARKETING_MANAGE_ROLES, 'Only a Marketing manager can connect accounts');
  if (deny) return back('connectError=Only%20a%20Marketing%20manager%20can%20connect%20accounts');

  const provider = providerById(id);
  if (!provider) return back('connectError=Unknown%20platform');
  if (!providerConfigured(provider)) return back(`connectError=${encodeURIComponent(`${provider.label} isn’t set up on the server yet`)}`);

  const state = randomBytes(24).toString('base64url');
  const res = NextResponse.redirect(provider.authUrl(state, callbackUrl(provider.id)));
  res.cookies.set(OAUTH_STATE_COOKIE, `${provider.id}.${state}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/api/marketing/social',
  });
  return res;
}
