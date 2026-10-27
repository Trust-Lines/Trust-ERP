import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { hasAnyCriterion } from '@/lib/marketing/prospectQuery';
import { parseAudience } from '@/lib/email/campaigns';
import { audienceParams, EmailError, launchCampaign, sendCampaignBatch } from '@/lib/email/sender';

export const maxDuration = 300;

// Contacts → "Send with a template": sends a template to every Contact matching the SAME
// query-builder criteria the Contacts page is showing (2026-09-24). Since 129 this is an email
// campaign under the hood — sent from the person's own mailbox, in batches within their daily
// limit, with tracking and an unsubscribe link, and it shows up in Email Campaigns with a report.
export async function POST(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { templateId?: string; filters?: unknown } | null;
  const templateId = body?.templateId?.trim();
  if (!templateId) return NextResponse.json({ error: 'templateId is required' }, { status: 400 });

  const audience = parseAudience(body?.filters);
  // Same "no bare browsing" rule as the list/export routes — a bulk send with zero criteria
  // would be exactly the unrestricted blast this whole feature exists to prevent.
  if (!hasAnyCriterion(audienceParams(audience))) return NextResponse.json({ error: 'Set at least one filter before sending.' }, { status: 400 });

  const { data: template, error: templateError } = await admin.from('mail_templates')
    .select('name, subject, body_html').eq('id', templateId).is('deleted_at', null).maybeSingle();
  if (templateError) return NextResponse.json({ error: 'Could not load the template' }, { status: 500 });
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const { data: campaign, error } = await admin.from('email_campaigns').insert({
    name: `${template.name} — Contacts query, ${new Date().toISOString().slice(0, 10)}`,
    subject: template.subject, body_html: template.body_html, template_id: templateId,
    audience, status: 'draft', created_by: user.id, sender_user_id: user.id,
  }).select('id').single();
  if (error) return NextResponse.json({ error: 'Could not create the email campaign (is migration 129 applied?)' }, { status: 500 });

  try {
    const { queued } = await launchCampaign(admin, campaign.id, user.id, role);
    const first = await sendCampaignBatch(admin, campaign.id);
    await logAudit({
      actorId: user.id, action: 'mail_template.bulk_sent', resource: `mail_template:${templateId}`,
      newValue: { campaign: campaign.id, queued, sentNow: first.sent, filters: audience },
    });
    return NextResponse.json({ campaignId: campaign.id, queued, sent: first.sent, failed: first.failed, done: first.done });
  } catch (e) {
    // Nothing went out — drop the empty draft so it doesn't clutter Email Campaigns.
    await admin.from('email_campaigns').update({ deleted_at: new Date().toISOString() }).eq('id', campaign.id).eq('status', 'draft');
    if (e instanceof EmailError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[bulk-send]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not send' }, { status: 500 });
  }
}
