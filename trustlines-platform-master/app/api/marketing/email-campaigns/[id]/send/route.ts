import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { loadCampaignFor } from '@/lib/email/campaignAccess';
import { campaignProblems, EmailError, launchCampaign, resolveAudience, sendCampaignBatch } from '@/lib/email/sender';
import { loadSender } from '@/lib/email/mailSettings';

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

// { at?: ISO } → schedule for that time; no `at` → send now (the first batch goes out in this
// request, the rest every 10 minutes from the cron, within the sender's daily limit).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { campaign, deny: notFound } = await loadCampaignFor(admin, id, user.id, role);
  if (notFound) return notFound;

  const body = await req.json().catch(() => ({})) as { at?: string };
  try {
    const problem = campaignProblems(campaign);
    if (problem) throw new EmailError(problem);
    if (!await loadSender(admin, user.id)) throw new EmailError('Set up your email account first: Settings → Email sending.', 412);

    if (body.at) {
      const at = new Date(body.at);
      if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000) throw new EmailError('Pick a time in the future.');
      if (!['draft', 'scheduled'].includes(campaign.status)) throw new EmailError('This campaign has already been sent or is sending.', 409);
      // Count now, so a schedule that would reach nobody is caught today rather than at send time.
      const { recipients } = await resolveAudience(admin, user.id, role, campaign.audience ?? {});
      if (!recipients.length) throw new EmailError('Nobody to send to — every matching Contact is missing an email or has unsubscribed.');
      await admin.from('email_campaigns').update({ status: 'scheduled', scheduled_at: at.toISOString(), sender_user_id: user.id, recipient_count: recipients.length, last_error: null }).eq('id', id);
      await logAudit({ actorId: user.id, action: 'email_campaign.scheduled', resource: `email_campaign:${id}`, newValue: { at: at.toISOString(), recipients: recipients.length } });
      return NextResponse.json({ ok: true, scheduled: at.toISOString(), recipients: recipients.length });
    }

    const { queued } = await launchCampaign(admin, id, user.id, role);
    await logAudit({ actorId: user.id, action: 'email_campaign.sent', resource: `email_campaign:${id}`, newValue: { queued } });
    const first = await sendCampaignBatch(admin, id);
    return NextResponse.json({ ok: true, queued, ...first });
  } catch (e) {
    if (e instanceof EmailError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[email send]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not send the campaign' }, { status: 500 });
  }
}
