import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { getAssignedRegions } from '@/lib/access/regionScope';

const LIST_COLS = 'id, prospect_id, title, opportunity_type, project_types, stage, source_label, '
  + 'marketing_owner_id, sales_owner_id, deadline, expected_close_date, next_action, next_action_date, '
  + 'auto_managed, admin_corrected, created_at, updated_at';

export async function GET(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const stage = (url.searchParams.get('stage') ?? '').trim();
  const q = (url.searchParams.get('q') ?? '').trim();

  let query = admin.from('opportunities').select(LIST_COLS).is('deleted_at', null);
  // 🔴 2026-09-16: same fix as app/api/marketing/prospects/route.ts — this used to be a
  // hardcoded ownership-only filter for marketing_pr (the only role MARKETING_READ_ROLES
  // allows here besides the "see all" roles), never updated for the region-aware "no
  // region assigned → see everything" rule migrations 108/109 already gave this role at
  // the RLS layer. Left as ownership-only, this route silently returned far fewer rows
  // than the RLS-scoped page load, the same class of bug reported as "the list empties
  // out after closing a detail view, a refresh fixes it."
  if (!MARKETING_SEE_ALL_ROLES.includes(role)) {
    const assignedRegions = await getAssignedRegions(admin, user.id);
    if (assignedRegions.length > 0) query = query.in('region', assignedRegions);
  }
  if (stage) query = query.eq('stage', stage);
  if (q) query = query.ilike('title', `%${q.replace(/[%,()\\]/g, '\\$&')}%`);
  query = query.order('updated_at', { ascending: false }).limit(500);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunities: data ?? [] });
}
