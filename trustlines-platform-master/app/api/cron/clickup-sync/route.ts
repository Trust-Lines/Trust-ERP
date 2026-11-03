import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { notifyUsers, usersWithRoles } from '@/lib/events/notify';
import { runClickUpSync, type SyncReport } from '@/lib/clickup/dailySync';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 300;

// Daily ClickUp → app top-up: only what's new in ClickUp — Contacts and Opportunities /
// Potentials (lib/clickup/dailySync.ts has the rules). Scheduled in vercel.json; Vercel calls it
// with GET and `Authorization: Bearer $CRON_SECRET`.
//   ?dry=1                       report only, nothing written
//   CLICKUP_SYNC_DISABLED=true   (env) stops the daily run without a deploy of code
// The General Managers get a notification with what came in (or what failed).
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const write = new URL(req.url).searchParams.get('dry') !== '1';
  if (write && process.env.CLICKUP_SYNC_DISABLED === 'true') return NextResponse.json({ ok: true, skipped: 'CLICKUP_SYNC_DISABLED' });
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ error: 'CLICKUP_API_TOKEN is not set' }, { status: 500 });

  const admin = createAdminClient() as any;
  const actorEmail = process.env.CLICKUP_IMPORT_ACTOR_EMAIL || 'hamzag@trust-lines.com';
  const { data: actor } = await admin.from('profiles').select('id').ilike('email', actorEmail).maybeSingle();
  if (!actor) return NextResponse.json({ error: `No profile for ${actorEmail} (CLICKUP_IMPORT_ACTOR_EMAIL)` }, { status: 500 });

  const tell = async (title: string, body: string) => {
    try {
      await notifyUsers(admin, { userIds: await usersWithRoles(admin, ['general_manager']), projectId: null, type: 'clickup.sync', title, body, link: '/marketing/prospects' });
    } catch { /* best effort */ }
  };

  try {
    const report = await runClickUpSync(admin, { write, actorId: actor.id });
    const counts = summary(report);
    if (write) {
      await logAudit({ actorId: null, action: 'clickup.daily_sync', resource: 'clickup', newValue: { ...counts, report } });
      const added = counts.contacts + counts.extraContacts + counts.potentials + counts.opportunities;
      // Held-back contacts and skipped deals come back every day until someone sorts them out,
      // so they don't trigger a notification on their own — only listed alongside news.
      if (added || counts.failed) await tell('ClickUp — daily update', describe(report));
    }
    return NextResponse.json({ ok: true, write, ...counts, report });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'ClickUp sync failed';
    console.error('[clickup-sync]', message);
    if (write) await tell('ClickUp daily update failed', `Nothing new was brought in from ClickUp today: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function summary(r: SyncReport) {
  return {
    contacts: r.contacts.added.length, extraContacts: r.contacts.extraContacts.length, held: r.contacts.held.length,
    potentials: r.deals.potentials.length, opportunities: r.deals.opportunities.length, dealsSkipped: r.deals.skipped.length,
    failed: r.contacts.failed.length + r.deals.failed.length, fileProblems: r.fileProblems.length,
  };
}

function describe(r: SyncReport): string {
  const names = (xs: { name: string }[]) => xs.slice(0, 8).map(x => x.name).join(', ') + (xs.length > 8 ? ` +${xs.length - 8} more` : '');
  return [
    r.contacts.added.length && `New contacts: ${r.contacts.added.length} (${names(r.contacts.added)})`,
    r.contacts.extraContacts.length && `New people on existing companies: ${r.contacts.extraContacts.length}`,
    r.deals.opportunities.length && `New opportunities: ${r.deals.opportunities.length} (${names(r.deals.opportunities)})`,
    r.deals.potentials.length && `New potentials: ${r.deals.potentials.length} (${names(r.deals.potentials)})`,
    r.contacts.held.length && `Held back (may already be in the app): ${r.contacts.held.length} (${names(r.contacts.held)})`,
    r.deals.skipped.length && `Deals not added: ${r.deals.skipped.length} (${r.deals.skipped.slice(0, 5).map(x => `${x.name} — ${x.note}`).join('; ')})`,
    (r.contacts.failed.length + r.deals.failed.length) && `Failed: ${r.contacts.failed.length + r.deals.failed.length}`,
  ].filter(Boolean).join('\n');
}

export const GET = run;
export const POST = run;
