import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deriveSecret } from '@/lib/crypto/secrets';
import { clickSignature } from '@/lib/email/compose';
import { isToken, recordClick } from '@/lib/email/tracking';
import { appBaseUrl } from '@/lib/env/appUrl';

type Params = { params: Promise<{ token: string }> };

// Tracked link: records the click, then sends the reader on to the real URL. The signature
// covers token + URL, so this can't be used to redirect anyone to a site of an attacker's choosing.
export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get('u') ?? '';
  const sig = url.searchParams.get('s') ?? '';

  let valid: boolean;
  try {
    const expected = clickSignature(token, target, deriveSecret('email-click'));
    valid = isToken(token) && /^https?:\/\//i.test(target) && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    valid = false;
  }
  if (!valid) return NextResponse.redirect(appBaseUrl());

  try {
    await recordClick(createAdminClient(), token, target, req.headers.get('user-agent'));
  } catch (e) {
    console.error('[email click]', e instanceof Error ? e.message : e);
  }
  return NextResponse.redirect(target, 302);
}
