import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { DELIVERY_READ_ROLES, PUNCH_WRITE_ROLES } from '@/lib/delivery/config';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, project_id, title, description, status, resolved_at, created_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(DELIVERY_READ_ROLES);
  if (deny) return deny;
  const res = await admin.from('punch_list_items').select(COLS).eq('project_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  if (res.error) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: res.data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(PUNCH_WRITE_ROLES);
  if (deny) return deny;

  const { data: proj } = await admin.from('projects').select('id').eq('id', id).maybeSingle();
  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const b = await req.json().catch(() => null) as { title?: string; description?: string } | null;
  const title = b?.title?.trim();
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const { data, error } = await admin.from('punch_list_items').insert({
    project_id: id, title, description: b?.description?.trim() || null, status: 'open', created_by: user.id,
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'punch_item.created', projectId: id, resource: `punch_list_item:${data.id}`, newValue: { title } });
  return NextResponse.json({ item: data }, { status: 201 });
}
