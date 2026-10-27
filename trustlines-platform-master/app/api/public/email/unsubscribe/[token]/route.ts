import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isToken, unsubscribe } from '@/lib/email/tracking';

type Params = { params: Promise<{ token: string }> };

// POST = unsubscribe. Used by the button on /unsubscribe/<token> and by mail apps' one-click
// "Unsubscribe" (RFC 8058, the List-Unsubscribe-Post header) — Gmail and Yahoo require it for bulk mail.
// Only POST changes anything: link scanners that open every URL in an email (GET) can't unsubscribe people.
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  if (!isToken(token)) return NextResponse.json({ error: 'Unknown link' }, { status: 404 });
  try {
    const email = await unsubscribe(createAdminClient(), token, req.headers.get('user-agent'));
    if (!email) return NextResponse.json({ error: 'Unknown link' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[email unsubscribe]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not unsubscribe — please try again' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, req.url));
}
