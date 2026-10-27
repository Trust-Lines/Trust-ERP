import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncAccounts } from '@/lib/social/service';

export const maxDuration = 300;

// Vercel cron (vercel.json, nightly): refreshes followers and post results for every connected
// social account. Read-only on the platforms. Called with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const results = await syncAccounts(createAdminClient());
    return NextResponse.json({ synced: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
  } catch (e) {
    console.error('[cron social-sync]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Sync run failed' }, { status: 500 });
  }
}
