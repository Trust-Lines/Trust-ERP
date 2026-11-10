import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { createRawAdminClient } from '@/lib/supabase/admin';
import { processDropboxChanges } from '@/lib/dropbox/autoSync';

// Fallback for the Dropbox webhook: reads the same change feed, so a missed / failed webhook call
// is caught up within 10 minutes (.github/workflows/frequent-crons.yml; daily in vercel.json).
export const maxDuration = 300;

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await processDropboxChanges(createRawAdminClient() as any, getDropboxClient());
    if (r.status === 'missing_table') return NextResponse.json({ error: 'Migration 146 not applied' }, { status: 503 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Dropbox sync failed';
    console.error('[dropbox-sync]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
