import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/env/appUrl';
import { checkRateLimit, clientIp, hashIp } from '@/lib/security/rateLimit';

// Public by design (the person can't sign in). Never reveals whether an address has an
// account: every well-formed request gets the same answer. Sent from the server with a plain
// (non-PKCE) client so the e-mailed link also works when opened on another device/browser.
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const WINDOW_SECONDS = 3600;
const PER_IP = 8;
const PER_EMAIL = 3;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [ipHash, emailHash] = await Promise.all([hashIp(clientIp(req.headers)), hashIp(email)]);
  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(admin, `forgot:ip:${ipHash}`, PER_IP, WINDOW_SECONDS),
    checkRateLimit(admin, `forgot:email:${emailHash}`, PER_EMAIL, WINDOW_SECONDS),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appBaseUrl()}/auth/set-password` });
  // Log, but answer identically — a failure here must not become an account-existence oracle.
  if (error) console.error('[forgot-password]', error.message);

  return NextResponse.json({ ok: true });
}
