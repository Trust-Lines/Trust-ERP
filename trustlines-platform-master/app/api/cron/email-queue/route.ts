import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runEmailQueue } from '@/lib/email/sender';

export const maxDuration = 300;

// Vercel cron (vercel.json, every 10 minutes): starts scheduled email campaigns and sends the
// next batch of each sending one, within every sender's daily limit.
// Called with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runEmailQueue(createAdminClient()));
  } catch (e) {
    console.error('[cron email-queue]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Email queue run failed' }, { status: 500 });
  }
}
