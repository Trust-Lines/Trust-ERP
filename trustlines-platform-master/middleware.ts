import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() verifies the JWT signature (locally with asymmetric signing keys, otherwise via
  // the Auth server) and refreshes an expired session — same guarantees as getUser() without a
  // network round trip on every single click.
  const { pathname } = request.nextUrl;
  // The mobile app calls /api/* with `Authorization: Bearer <jwt>` instead of cookies; the same
  // signature/expiry check applies to that token.
  const authHeader = request.headers.get('authorization') ?? '';
  const bearer = pathname.startsWith('/api/') && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim() || undefined
    : undefined;

  const { data: claimsData } = await supabase.auth.getClaims(bearer);
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const publicPaths = ['/login', '/tlines-login', '/trustlines-login', '/auth/callback', '/auth/set-password', '/auth/forgot-password', '/api/auth/forgot-password', '/review', '/survey', '/unsubscribe', '/quote', '/contract', '/install/', '/video-upload/', '/api/public', '/api/cron', '/api/dropbox/webhook'];
  const isPublic = publicPaths.some(p => pathname.startsWith(p));

  // An expired / forged mobile token gets a 401 the app can act on, not the web login page.
  if (!user && bearer && !isPublic) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The Trust System proxy answers like an API (401), not with a login page redirect.
  if (!user && pathname.startsWith('/api/trust/')) {
    return NextResponse.json({ statusCode: 401, message: 'Sign in to T-ERP' }, { status: 401 });
  }

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === '/login') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/home';
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
