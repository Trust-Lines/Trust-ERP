import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordStageSnapshot } from '@/lib/board/stageHistory';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Daily: record which dashboard step every card is in (board_stage_spells, migration 157), so the
// dashboard's step + From / To filter can list the cards that were in a step during a period.
// Scheduled in vercel.json; Vercel calls it with `Authorization: Bearer $CRON_SECRET`.
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const report = await recordStageSnapshot(createAdminClient() as any);
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Board snapshot failed';
    console.error('[board-snapshot]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
