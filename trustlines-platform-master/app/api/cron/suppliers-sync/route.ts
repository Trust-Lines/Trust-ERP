import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { syncSuppliersFromTrust } from '@/lib/suppliers/trustSync';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Daily: new / renamed Trust System Production vendors → Suppliers (lib/suppliers/trustSync).
// Adds and updates only — a supplier added by hand here is never removed by the daily run.
// Scheduled in vercel.json; Vercel calls it with `Authorization: Bearer $CRON_SECRET`.
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const report = await syncSuppliersFromTrust(createAdminClient() as any);
    if (report.added.length || report.updated.length) {
      await logAudit({ actorId: null, action: 'suppliers.synced_from_trust', resource: 'suppliers', newValue: { ...report } });
    }
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Supplier sync failed';
    console.error('[suppliers-sync]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
