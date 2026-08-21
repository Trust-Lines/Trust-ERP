import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';

const LIST_COLS = 'id, need_id, prospect_id, title, potential_type, status, target_contact_date, '
  + 'estimated_value, currency, confidence, assigned_to, converted_opportunity_id, auto_managed, created_at, updated_at';

export async function GET(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') ?? '').trim();
  const q = (url.searchParams.get('q') ?? '').trim();

  let query = admin.from('prospect_potentials').select(LIST_COLS).is('deleted_at', null);
  if (!MARKETING_SEE_ALL_ROLES.includes(role)) {
    const { data: ownProspects } = await admin.from('prospects').select('id')
      .or(`created_by.eq.${user.id},assigned_marketing_user_id.eq.${user.id},owner_id.eq.${user.id}`)
      .limit(1000);
    const ids = (ownProspects ?? []).map((p: { id: string }) => p.id);
    if (!ids.length) return NextResponse.json({ potentials: [] });
    query = query.in('prospect_id', ids);
  }
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('title', `%${q.replace(/[%,()\\]/g, '\\$&')}%`);
  query = query.order('target_contact_date', { ascending: true, nullsFirst: false }).limit(500);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ potentials: data ?? [] });
}
