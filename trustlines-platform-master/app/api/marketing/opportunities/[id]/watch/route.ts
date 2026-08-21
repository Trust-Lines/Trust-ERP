import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('lead_watchers').select('user_id').eq('opportunity_id', id);
  if (error) return NextResponse.json({ watching: false, count: 0 });
  const rows = (data ?? []) as { user_id: string }[];
  return NextResponse.json({ watching: rows.some(r => r.user_id === user.id), count: rows.length });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: existing } = await admin.from('lead_watchers')
    .select('user_id').eq('opportunity_id', id).eq('user_id', user.id).maybeSingle();

  if (existing) {
    await admin.from('lead_watchers').delete().eq('opportunity_id', id).eq('user_id', user.id);
    return NextResponse.json({ watching: false });
  }
  const { error } = await admin.from('lead_watchers').insert({ opportunity_id: id, user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watching: true });
}
