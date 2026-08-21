import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';

const LIST_COLS = 'id, prospect_id, need_id, title, project_types, scope_types, stage, deadline, '
  + 'sales_owner_id, sales_handoff_at, sales_accepted_at, project_id, created_at, updated_at';

const SALES_VISIBLE_STAGES = [
  'sales_handoff', 'sales_accepted', 'discovery', 'sales_design', 'proposal',
  'negotiation', 'closed_won', 'closed_lost',
];

export async function GET(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const stage = (url.searchParams.get('stage') ?? '').trim();

  let query = admin.from('opportunities').select(LIST_COLS).is('deleted_at', null)
    .or(`stage.in.(${SALES_VISIBLE_STAGES.join(',')}),sales_owner_id.eq.${user.id}`);
  if (stage) query = query.eq('stage', stage);
  query = query.order('sales_handoff_at', { ascending: true, nullsFirst: false }).limit(500);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunities: data ?? [] });
}
