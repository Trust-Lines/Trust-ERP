import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publishDuePosts } from '@/lib/social/service';

export const maxDuration = 300;

// Vercel cron (vercel.json, every 15 minutes): publishes scheduled social posts whose time has
// come. Called with `Authorization: Bearer $CRON_SECRET`.
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
