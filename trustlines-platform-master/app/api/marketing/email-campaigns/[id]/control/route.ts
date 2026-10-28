import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { loadCampaignFor } from '@/lib/email/campaignAccess';
import { loadSender } from '@/lib/email/mailSettings';

type Params = { params: Promise<{ id: string }> };

// pause (stop after the current batch) · resume · unschedule (back to draft) · cancel (the
// emails not sent yet are dropped; what went out stays in the report).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { campaign, deny: notFound } = await loadCampaignFor(admin, id, user.id, role);
  if (notFound) return notFound;

  const { action } = await req.json().catch(() => ({})) as { action?: string };
  const s = campaign.status;
  let patch: Record<string, unknown> | null = null;
  if (action === 'pause' && s === 'sending') patch = { status: 'paused' };
  else if (action === 'resume' && s === 'paused') {
    // A paused campaign that never started (a failed schedule) has no queue — send it again from the editor.
    if (!campaign.started_at) patch = { status: 'draft', scheduled_at: null };
    else {
      if (!await loadSender(admin, user.id)) return NextResponse.json({ error: 'Set up your email account first: Settings → Email sending.' }, { status: 412 });
      patch = { status: 'sending', sender_user_id: user.id, last_error: null };
    }
  } else if (action === 'unschedule' && s === 'scheduled') patch = { status: 'draft', scheduled_at: null };
  else if (action === 'cancel' && ['sending', 'paused', 'scheduled'].includes(s)) {
    await admin.from('email_messages').update({ status: 'skipped', error: 'Campaign cancelled' }).eq('campaign_id', id).eq('status', 'queued');
    patch = { status: campaign.started_at ? 'cancelled' : 'draft', finished_at: campaign.started_at ? new Date().toISOString() : null, scheduled_at: null };
  }
  if (!patch) return NextResponse.json({ error: `Can’t ${action ?? 'do that'} a ${s} campaign` }, { status: 409 });

  const { error } = await admin.from('email_campaigns').update(patch).eq('id', id).eq('status', s);
  if (error) return NextResponse.json({ error: 'Could not update the campaign' }, { status: 500 });
  await logAudit({ actorId: user.id, action: `email_campaign.${action}`, resource: `email_campaign:${id}` });
  return NextResponse.json({ ok: true, status: patch.status });
}
