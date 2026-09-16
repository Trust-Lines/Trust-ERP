import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { getAssignedRegions } from '@/lib/access/regionScope';

const LIST_COLS = 'id, need_id, prospect_id, title, potential_type, status, target_contact_date, '
  + 'estimated_value, currency, confidence, assigned_to, converted_opportunity_id, auto_managed, created_at, updated_at';

export async function GET(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') ?? '').trim();
  const q = (url.searchParams.get('q') ?? '').trim();

  let query = admin.from('prospect_potentials').select(LIST_COLS).is('deleted_at', null);
  // 🔴 2026-09-16: same fix as app/api/marketing/prospects/route.ts — ownership-only
  // filter never updated for the "no region assigned → see everything" rule (108/109).
  if (!MARKETING_SEE_ALL_ROLES.includes(role)) {
    const assignedRegions = await getAssignedRegions(admin, user.id);
    if (assignedRegions.length > 0) query = query.in('region', assignedRegions);
  }
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('title', `%${q.replace(/[%,()\\]/g, '\\$&')}%`);
  query = query.order('target_contact_date', { ascending: true, nullsFirst: false }).limit(500);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ potentials: data ?? [] });
}
