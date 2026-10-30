import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed, permCan } from '@/lib/permissions/catalog';

// Trust System proxy: /api/trust/<path> → TRUST_API_URL/<path> with the server-side X-API-Key
// (docs/T-ERP-INTEGRATION.md). The key never reaches the browser.
//
// Behind T-ERP's login (middleware answers 401 when signed out) and the Production permissions:
// reading needs the Production page, any write also needs "Change production board".
// The key acts as an ADMIN in the Trust System, so these checks are what limits T-ERP users.

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path: string[] }> };

const PASS_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'cache-control'];

async function forward(req: NextRequest, { params }: Ctx) {
  const base = process.env.TRUST_API_URL?.replace(/\/+$/, '');
  const key = process.env.TRUST_API_KEY;
  if (!base || !key) {
    return NextResponse.json({ statusCode: 503, message: 'Trust System connection is not configured (TRUST_API_URL / TRUST_API_KEY).' }, { status: 503 });
  }

  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);
  if (!pageAllowed(role, perms, 'page.production')) {
    return NextResponse.json({ statusCode: 403, message: 'No access to the Production board' }, { status: 403 });
  }
  const isWrite = !['GET', 'HEAD'].includes(req.method);
  if (isWrite && !permCan(perms, 'edit.production')) {
    return NextResponse.json({ statusCode: 403, message: 'You can view the Projects board but not change it' }, { status: 403 });
  }

  const { path } = await params;
  if (!path?.length || path.some(p => p === '..' || p === '.' || p === '')) {
    return NextResponse.json({ statusCode: 400, message: 'Bad path' }, { status: 400 });
  }
  const url = `${base}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const contentType = req.headers.get('content-type');
  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers: {
        'X-API-Key': key,
        Accept: req.headers.get('accept') ?? 'application/json',
        ...(contentType ? { 'Content-Type': contentType } : {}),
      },
      body: isWrite ? await req.arrayBuffer() : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (e) {
    console.error('[trust proxy]', req.method, path.join('/'), e instanceof Error ? e.message : e);
    return NextResponse.json({ statusCode: 502, message: 'Could not reach the Trust System' }, { status: 502 });
  }

  const headers = new Headers();
  for (const h of PASS_RESPONSE_HEADERS) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Response(res.status === 204 || res.status === 304 ? null : res.body, { status: res.status, headers });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
