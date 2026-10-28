import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { campaignProblems, EmailError, sendTestEmail } from '@/lib/email/sender';
import { loadCampaignFor } from '@/lib/email/campaignAccess';

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// "Send a test to me": the saved campaign, with sample merge data, to the sender's own inbox.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { campaign, deny: notFound } = await loadCampaignFor(admin, id, user.id, role);
  if (notFound) return notFound;
  const problem = campaignProblems(campaign);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  try {
    const r = await sendTestEmail(admin, user.id, { subject: campaign.subject, html: campaign.body_html, preheader: campaign.preheader, campaign: true });
    return NextResponse.json({ ok: true, to: r.to });
  } catch (e) {
    if (e instanceof EmailError) return NextResponse.json({ error: e.message }, { status: e.status });
    const message = e instanceof Error ? e.message : String(e);
    console.error('[email test]', message);
    return NextResponse.json({ error: `Could not send the test: ${message.slice(0, 200)}` }, { status: 500 });
  }
}
