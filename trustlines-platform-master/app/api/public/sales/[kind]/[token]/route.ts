import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { declineContract, decideEstimate, loadPublic, PublicActionError, signContract } from '@/lib/sales/documentsServer';
import { checkRateLimit, clientIp } from '@/lib/security/rateLimit';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Params = { params: Promise<{ kind: string; token: string }> };

// Public: the customer's estimate / contract page reads and answers through here. The secure
// token in the link is the only key; nothing internal (who made it, notes) is returned.
export async function GET(_req: NextRequest, { params }: Params) {
  const { kind, token } = await params;
  if (kind !== 'estimate' && kind !== 'contract') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const p = await loadPublic(createAdminClient() as any, kind, token).catch(() => null);
  if (!p) return NextResponse.json({ error: 'This link isn’t valid any more' }, { status: 404 });
  const { opp: _opp, ...rest } = p;
  void _opp;
  return NextResponse.json(rest);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { kind, token } = await params;
  const ip = clientIp(req.headers);
  const admin = createAdminClient() as any;
  const { allowed } = await checkRateLimit(admin, `public-sales:${ip}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: 'Too many attempts — try again in a minute' }, { status: 429 });

  const b = await req.json().catch(() => ({})) as { action?: string; name?: string; title?: string; note?: string; agree?: boolean };
  const name = (b.name ?? '').trim().slice(0, 120);
  const note = (b.note ?? '').trim().slice(0, 2000) || null;
  try {
    if (kind === 'estimate' && (b.action === 'accept' || b.action === 'reject')) {
      if (!name) return NextResponse.json({ error: 'Please type your name' }, { status: 400 });
      await decideEstimate(admin, token, b.action === 'accept' ? 'accepted' : 'rejected', name, note);
      return NextResponse.json({ ok: true });
    }
    if (kind === 'contract' && b.action === 'sign') {
      if (name.length < 3) return NextResponse.json({ error: 'Please type your full name to sign' }, { status: 400 });
      if (b.agree !== true) return NextResponse.json({ error: 'Please tick the box to confirm you agree' }, { status: 400 });
      await signContract(admin, token, { name, title: (b.title ?? '').trim().slice(0, 120) || null, ip, userAgent: req.headers.get('user-agent') });
      return NextResponse.json({ ok: true });
    }
    if (kind === 'contract' && b.action === 'decline') {
      if (!note) return NextResponse.json({ error: 'Please tell us why' }, { status: 400 });
      await declineContract(admin, token, note);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    if (e instanceof PublicActionError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[public sales doc]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
