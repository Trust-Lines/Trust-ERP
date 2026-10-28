import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publishDuePosts } from '@/lib/social/service';

export const maxDuration = 300;

// Every 10 minutes from the GitHub Actions workflow .github/workflows/frequent-crons.yml (the
// Vercel plan only allows daily crons; vercel.json runs it once a day as a fallback): publishes
// scheduled social posts whose time has come. Called with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const results = await publishDuePosts(createAdminClient());
    return NextResponse.json({ published: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
  } catch (e) {
    console.error('[cron social-publish]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Publish run failed' }, { status: 500 });
  }
}
