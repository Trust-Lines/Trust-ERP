import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { logLeadActivity } from '@/lib/sales/activity';
import { notifyLeadWatchers } from '@/lib/sales/notify';
import { assertLeadAccess } from '@/lib/sales/leadAccess';
import { ensureDesignJobForLead, DESIGN_TRIGGER_STATUS } from '@/lib/sales/design';
import { STATUS_META } from '@/components/platform/leads/types';

const STATUSES = new Set(Object.keys(STATUS_META));
const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(STATUS_META).map(s => [s.key, s.label]),
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { opportunity_status } = await req.json() as { opportunity_status?: string };
  if (!opportunity_status || !STATUSES.has(opportunity_status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { error } = await admin.from('lead_intake')
    .update({ opportunity_status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logLeadActivity(admin, { leadIntakeId: id, actorId: user.id, kind: 'change', body: `moved to ${STATUS_LABELS[opportunity_status]}` });
  await notifyLeadWatchers(admin, { leadId: id, actorId: user.id, title: 'Lead status changed', body: `Moved to ${STATUS_LABELS[opportunity_status]}` });

  if (opportunity_status === DESIGN_TRIGGER_STATUS) {
    await ensureDesignJobForLead(admin, id, user.id);
  }
  return NextResponse.json({ ok: true });
}
