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

  const { data, error } = await admin.from('lead_tasks')
    .select('id, title, status, assignee_id, due_date, created_at')
    .eq('opportunity_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ tasks: [] });

  const ids = [...new Set((data ?? []).map((t: { assignee_id: string | null }) => t.assignee_id).filter(Boolean))];
  const { data: people } = ids.length
    ? await admin.from('profiles').select('id, full_name').in('id', ids)
    : { data: [] };
  const nameById = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));

  const tasks = (data ?? []).map((t: { assignee_id: string | null }) => ({
    ...t, assignee_name: t.assignee_id ? (nameById.get(t.assignee_id) ?? null) : null,
  }));
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { title } = await req.json() as { title?: string };
  const text = (title ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const { data, error } = await admin.from('lead_tasks')
    .insert({ opportunity_id: id, title: text, created_by: user.id })
    .select('id, title, status, assignee_id, due_date, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: { ...(data as object), assignee_name: null } });
}
