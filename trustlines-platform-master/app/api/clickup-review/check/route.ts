import { NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { runClickUpSync } from '@/lib/clickup/dailySync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ClickUp Review → "Check now": the nightly sync in report-only mode (ClickUp is only read, nothing
// is written to the app), stored like the nightly report so the review screen shows it. ~1 minute.
export async function POST() {
  const { user, admin, deny } = await requireApiPage('page.clickup_review');
  if (deny) return deny;
  if (!process.env.CLICKUP_API_TOKEN) return NextResponse.json({ error: 'ClickUp isn’t connected (CLICKUP_API_TOKEN)' }, { status: 500 });
  try {
    const report = await runClickUpSync(admin, { write: false, actorId: user.id });
    await logAudit({ actorId: user.id, action: 'clickup.review_check', resource: 'clickup', newValue: { report } });
    return NextResponse.json({ ok: true, held: report.contacts.held.length, skipped: report.deals.skipped.length });
  } catch (e) {
    console.error('[clickup-review/check]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not read ClickUp. Try again in a minute.' }, { status: 502 });
  }
}
