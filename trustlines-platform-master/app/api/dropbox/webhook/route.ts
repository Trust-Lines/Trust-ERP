import { NextRequest, NextResponse, after } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { createRawAdminClient } from '@/lib/supabase/admin';
import { processDropboxChanges, validWebhookSignature } from '@/lib/dropbox/autoSync';

// Dropbox webhook (App Console → Webhooks → https://t-erp.vercel.app/api/dropbox/webhook).
//   GET  — Dropbox's one-time check: echo the challenge back.
//   POST — "something changed": answer at once (Dropbox wants < 10 s), then read the change feed.
// Public in middleware.ts; the POST is trusted only with a valid X-Dropbox-Signature.
export const maxDuration = 300;

export function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('challenge') ?? '';
  return new NextResponse(challenge, {
    headers: { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!validWebhookSignature(body, req.headers.get('x-dropbox-signature'), process.env.DROPBOX_APP_SECRET)) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 403 });
  }
  after(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await processDropboxChanges(createRawAdminClient() as any, getDropboxClient());
      if (r.synced) console.log('[dropbox webhook]', r);
    } catch (e) {
      console.error('[dropbox webhook]', e instanceof Error ? e.message : e);
    }
  });
  return new NextResponse(null, { status: 200 });
}
