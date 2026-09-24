import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { buildFilterContext, fetchAllMatching, hasAnyCriterion, type ProspectQueryParams } from '@/lib/marketing/prospectQuery';
import { renderTemplate, type MergeContact } from '@/lib/marketing/mailTemplates';
import { sendEmail } from '@/lib/email/send';

// Sends a template to every Contact matching the SAME query-builder criteria the Contacts page
// is showing (2026-09-24) — never an arbitrary/unbounded blast. Capped and sequential (a short
// pause between sends) rather than parallel, so one flaky SMTP connection can't fan out into
// hundreds of simultaneous connections.
const SEND_CAP = 1000;
const DELAY_MS = 150;

type MergeRow = MergeContact & { display_name: string; main_email: string | null };
const MERGE_COLS = 'display_name, organization_name, person_name, brand_name, industry, region, state, source_label, main_email';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function POST(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { templateId?: string; filters?: Partial<ProspectQueryParams> } | null;
  const templateId = body?.templateId?.trim();
  if (!templateId) return NextResponse.json({ error: 'templateId is required' }, { status: 400 });

  const f = body?.filters ?? {};
  const params: ProspectQueryParams = {
    q: f.q ?? '', status: f.status ?? '', region: f.region ?? '', source: f.source ?? '',
    completeness: f.completeness ?? '', includeArchived: f.includeArchived ?? false,
    campaignId: f.campaignId ?? '', surveyOnly: f.surveyOnly ?? false, projectStatus: f.projectStatus ?? '',
  };
  // Same "no bare browsing" rule as the list/export routes — a bulk send with zero criteria
  // would be exactly the unrestricted blast this whole feature exists to prevent.
  if (!hasAnyCriterion(params)) return NextResponse.json({ error: 'Set at least one filter before sending.' }, { status: 400 });

  const { data: template, error: templateError } = await admin.from('mail_templates')
    .select('subject, body_html').eq('id', templateId).is('deleted_at', null).maybeSingle();
  if (templateError) return NextResponse.json({ error: templateError.message }, { status: 500 });
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const filterCtxResult = await buildFilterContext(admin, user.id, role, params);
  if ('error' in filterCtxResult) return NextResponse.json({ error: filterCtxResult.error }, { status: 500 });

  const result = await fetchAllMatching<MergeRow>(admin, 'prospects', MERGE_COLS, filterCtxResult, SEND_CAP);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 });

  const recipients = result.rows.filter(r => r.main_email);
  if (recipients.length === 0) return NextResponse.json({ error: 'No matching contacts have an email on file.' }, { status: 400 });
  if (recipients.length > SEND_CAP) {
    return NextResponse.json({ error: `${recipients.length} matches — narrow the query below ${SEND_CAP} before sending.` }, { status: 400 });
  }

  let sent = 0;
  const failed: string[] = [];
  for (const r of recipients) {
    try {
      await sendEmail(r.main_email as string, renderTemplate(template.subject, r), renderTemplate(template.body_html, r));
      sent += 1;
    } catch (e) {
      failed.push(r.main_email as string);
      console.error('[bulk-send] failed for', r.main_email, e);
    }
    await sleep(DELAY_MS);
  }

  await logAudit({
    actorId: user.id, action: 'mail_template.bulk_sent', resource: `mail_template:${templateId}`,
    newValue: { sent, failed: failed.length, totalMatched: result.rows.length, filters: params },
  });

  return NextResponse.json({ sent, failed: failed.length, totalMatched: result.rows.length });
}
