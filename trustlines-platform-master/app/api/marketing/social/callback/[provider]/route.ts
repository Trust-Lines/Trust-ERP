import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { appBaseUrl } from '@/lib/env/appUrl';
import { callbackUrl, OAUTH_STATE_COOKIE, providerById, providerConfigured } from '@/lib/social/providers';
import { attachAccounts, saveConnection, syncAccounts } from '@/lib/social/service';

export const maxDuration = 300;

type Params = { params: Promise<{ provider: string }> };

function finish(query: string) {
  const res = NextResponse.redirect(`${appBaseUrl()}/marketing/social?tab=accounts&${query}`);
  res.cookies.set(OAUTH_STATE_COOKIE, '', { maxAge: 0, path: '/api/marketing/social' });
  return res;
}
const fail = (message: string) => finish(`connectError=${encodeURIComponent(message)}`);

function sameState(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// The platform sends the manager back here with ?code&state. Exchange the code, store the
// (encrypted) tokens, link every account the login manages, and run a first sync.
export async function GET(req: NextRequest, { params }: Params) {
  const { provider: id } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return fail('Only a Marketing manager can connect accounts');

  const provider = providerById(id);
  if (!provider || !providerConfigured(provider)) return fail('This platform isn’t set up on the server');

  const url = new URL(req.url);
  const platformError = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (platformError) return fail(`Connection cancelled: ${platformError}`);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const cookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value ?? '';
  if (!code || !cookie.startsWith(`${provider.id}.`) || !sameState(cookie.slice(provider.id.length + 1), state)) {
    return fail('The connection link expired or was opened in another browser — please try again');
  }

  try {
    const tokens = await provider.exchangeCode(code, callbackUrl(provider.id));
    const found = await provider.discover(tokens);
    if (!found.length) {
      return fail(provider.id === 'meta'
        ? 'No Facebook Page was shared. Reconnect and tick the company Page (and its Instagram account) on the permission screen.'
        : 'This login doesn’t manage any company account on the platform.');
    }
    const connectionId = await saveConnection(admin, provider.id, tokens, user.id);
    const accountIds = await attachAccounts(admin, connectionId, found, user.id);
    await logAudit({
      actorId: user.id, action: 'social_connection.created', resource: `social_connection:${connectionId}`,
      newValue: { provider: provider.id, accounts: found.map(a => `${a.platform}:${a.handle}`) },
    });

    // First sync so the page isn't empty; any account that fails shows its own error there.
    let synced = 0;
    for (const accountId of accountIds) synced += (await syncAccounts(admin, accountId)).filter(r => r.ok).length;
    return finish(`connected=${encodeURIComponent(provider.label)}&accounts=${found.length}&synced=${synced}`);
  } catch (e) {
    console.error(`[social connect] ${provider.id}:`, e instanceof Error ? e.message : e);
    return fail(`Could not connect ${provider.label}: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
}
