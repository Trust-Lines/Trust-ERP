import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { parseAudience } from '@/lib/email/campaigns';
import { loadCampaignFor } from '@/lib/email/campaignAccess';
import { EmailError, resolveAudience } from '@/lib/email/sender';

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// Live "who would get this" count for the audience being edited (nothing is saved or sent).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { deny: notFound } = await loadCampaignFor(admin, id, user.id, role);
  if (notFound) return notFound;

  const body = await req.json().catch(() => ({})) as { audience?: unknown };
  try {
    const r = await resolveAudience(admin, user.id, role, parseAudience(body.audience));
    return NextResponse.json({
      matched: r.matched, noEmail: r.noEmail, suppressed: r.suppressed, recipients: r.recipients.length,
      sample: r.recipients.slice(0, 8).map(x => x.name ? `${x.name} <${x.email}>` : x.email),
    });
  } catch (e) {
    if (e instanceof EmailError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[email audience]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not count the audience' }, { status: 500 });
  }
}
