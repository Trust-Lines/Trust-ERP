import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { logLeadActivity } from '@/lib/sales/activity';
import { notifyLeadWatchers } from '@/lib/sales/notify';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: rows, error } = await admin.from('lead_activity')
    .select('id, actor_id, kind, body, created_at')
    .eq('opportunity_id', id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ activity: [] });

  const actorIds = [...new Set((rows ?? []).map((r: { actor_id: string | null }) => r.actor_id).filter(Boolean))];
  const { data: people } = actorIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] };
  const nameById = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));

  const activity = (rows ?? []).map((r: { id: string; actor_id: string | null; kind: string; body: string | null; created_at: string }) => ({
    ...r,
    actor_name: r.actor_id ? (nameById.get(r.actor_id) ?? 'Someone') : 'System',
  }));
  return NextResponse.json({ activity });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { body } = await req.json() as { body?: string };
  const text = (body ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });

  await logLeadActivity(admin, { opportunityId: id, actorId: user.id, kind: 'comment', body: text });
  await notifyLeadWatchers(admin, { opportunityId: id, actorId: user.id, title: 'New comment on an Opportunity', body: text.slice(0, 140) });
  return NextResponse.json({ ok: true });
}
