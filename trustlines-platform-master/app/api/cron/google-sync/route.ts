import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncAllGoogleCalendars } from '@/lib/google/sync';

export const maxDuration = 300;

// Every 10 minutes from .github/workflows/frequent-crons.yml (each calendar at most every 30
// minutes); daily from vercel.json as a fallback. Read-only on Google.
// Called with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const results = await syncAllGoogleCalendars(createAdminClient());
    return NextResponse.json({ synced: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
  } catch (e) {
    console.error('[cron google-sync]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Google sync run failed' }, { status: 500 });
  }
}
