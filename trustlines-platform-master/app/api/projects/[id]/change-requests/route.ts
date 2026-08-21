import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { FINALIZATION_READ_ROLES, FINALIZATION_WRITE_ROLES, CHANGE_REQUEST_CATEGORIES } from '@/lib/finalization/config';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, project_id, customer_contact_id, title, description, category, status, budget_impact, currency, timeline_impact_days, decision_note, resolved_at, created_at, updated_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(FINALIZATION_READ_ROLES);
  if (deny) return deny;

  const res = await admin.from('change_requests').select(COLS)
    .eq('project_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  if (res.error) return NextResponse.json({ changeRequests: [] });
  return NextResponse.json({ changeRequests: res.data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(FINALIZATION_WRITE_ROLES);
  if (deny) return deny;

  const { data: proj } = await admin.from('projects').select('id, currency').eq('id', id).maybeSingle();
  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const b = await req.json().catch(() => null) as {
    title?: string; description?: string; category?: string; customer_contact_id?: string | null;
    budget_impact?: number | null; timeline_impact_days?: number | null;
  } | null;
  const title = b?.title?.trim();
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const category = CHANGE_REQUEST_CATEGORIES.includes(b?.category ?? '') ? b!.category : null;
  const { data, error } = await admin.from('change_requests').insert({
    project_id: id,
    customer_contact_id: b?.customer_contact_id || null,
    title,
    description: b?.description?.trim() || null,
    category,
    status: 'open',
    budget_impact: b?.budget_impact ?? null,
    currency: (proj as { currency?: string }).currency ?? null,
    timeline_impact_days: b?.timeline_impact_days ?? null,
    created_by: user.id,
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'change_request.created', projectId: id, resource: `change_request:${data.id}`, newValue: { title } });
  return NextResponse.json({ changeRequest: data }, { status: 201 });
}
