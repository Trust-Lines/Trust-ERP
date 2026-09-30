import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { LEAD_STATUSES } from '@/lib/web-cms/leads';

type Params = { params: Promise<{ id: string }> };

// Status / internal note. "converted" is set only by the convert route, so it cannot be faked here.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as { status?: unknown; internal_note?: unknown } | null;

  const patch: Record<string, unknown> = {};
  if (typeof b?.status === 'string') {
    if (!LEAD_STATUSES.includes(b.status as never) || b.status === 'converted') return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    patch.status = b.status;
    patch.handled_by = user.id;
    patch.handled_at = new Date().toISOString();
  }
  if (typeof b?.internal_note === 'string') patch.internal_note = b.internal_note.trim().slice(0, 3000) || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'No changes given' }, { status: 400 });

  const { data, error } = await admin.from('web_leads').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'web_lead.updated', resource: `web_lead:${id}`, newValue: patch });
  return NextResponse.json({ lead: data });
}

// Hard delete: covers a person's deletion request.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const { error } = await admin.from('web_leads').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'web_lead.deleted', resource: `web_lead:${id}` });
  return NextResponse.json({ success: true });
}
