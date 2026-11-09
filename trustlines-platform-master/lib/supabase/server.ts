import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/database';
import type { User } from '@supabase/supabase-js';
import { withViewAs } from '@/lib/viewAs';

/**
 * The mobile app (mobile-app/) has no cookies: it sends its Supabase access token as
 * `Authorization: Bearer <jwt>`. When present, that token IS the session for this request.
 */
export const bearerToken = cache(async (): Promise<string | null> => {
  try {
    const auth = (await headers()).get('authorization') ?? '';
    return auth.startsWith('Bearer ') ? auth.slice(7).trim() || null : null;
  } catch {
    return null; // outside a request (build, scripts)
  }
});

export async function getSessionUser(): Promise<User | null> {
  if (await bearerToken()) return getVerifiedUser();
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export async function requireUser(): Promise<
  { user: User; unauth: null } | { user: null; unauth: ReturnType<typeof NextResponse.json> }
> {
  const user = await getSessionUser();
  if (!user) return { user: null, unauth: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { user, unauth: null };
}

async function createBaseClient() {
  const token = await bearerToken();
  if (token) {
    // PostgREST runs every query as the token's user, so RLS applies exactly as on the web.
    return createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { getAll: () => [], setAll: () => {} },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, verified ONCE per server request (React `cache` dedupes it across the
 * layout, `requirePage` and the page itself — before this, one page click made 2-3 serial
 * round trips to Supabase Auth just to ask "who is this?").
 *
 * `getClaims()` verifies the access-token JWT's signature (locally with asymmetric signing
 * keys; it falls back to the Auth server otherwise), so this is as trustworthy as `getUser()`.
 * The User object then comes from the same, now-verified session; if the ids ever disagree we
 * fall back to a full `getUser()` round trip.
 */
export const getVerifiedUser = cache(async (): Promise<User | null> => {
  const sb = await createBaseClient();
  const token = await bearerToken();
  if (token) {
    // The Auth server verifies the token (signature, expiry, revoked session).
    const { data: { user }, error } = await sb.auth.getUser(token);
    return error ? null : user ?? null;
  }
  const { data, error } = await sb.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user?.id === sub) return session.user;
  const { data: { user } } = await sb.auth.getUser();
  return user ?? null;
});

export async function createClient() {
  const client = await createBaseClient();
  // Every `supabase.auth.getUser()` in server components/pages (60+ call sites) goes through the
  // per-request verified user above instead of its own network round trip.
  const realGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (async (jwt?: string) => {
    if (jwt) return realGetUser(jwt);
    const user = await getVerifiedUser();
    return { data: { user }, error: null };
  }) as typeof client.auth.getUser;
  // A General Manager previewing another role sees that role on their own profile row.
  return withViewAs(client);
}
