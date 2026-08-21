import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';

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
  if (!MARKETING_SEE_ALL_ROLES.includes(role)) {
    const { data: ownProspects } = await admin.from('prospects').select('id')
      .or(`created_by.eq.${user.id},assigned_marketing_user_id.eq.${user.id},owner_id.eq.${user.id}`)
      .limit(1000);
    const ids = (ownProspects ?? []).map((p: { id: string }) => p.id);
    if (!ids.length) return NextResponse.json({ opportunities: [] });
    query = query.in('prospect_id', ids);
  }
  if (stage) query = query.eq('stage', stage);
  if (q) query = query.ilike('title', `%${q.replace(/[%,()\\]/g, '\\$&')}%`);
  query = query.order('updated_at', { ascending: false }).limit(500);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunities: data ?? [] });
}
