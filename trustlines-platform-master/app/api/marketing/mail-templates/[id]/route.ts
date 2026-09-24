import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, name, subject, body_html, created_by, created_at, updated_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await admin.from('mail_templates').select(COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;

  const body = await req.json().catch(() => null) as { name?: string; subject?: string; body_html?: string } | null;
  const patch: Record<string, string> = {};
  if (typeof body?.name === 'string') {
    const v = body.name.trim();
    if (!v) return NextResponse.json({ error: 'Template name cannot be empty' }, { status: 400 });
    patch.name = v;
  }
  if (typeof body?.subject === 'string') {
    const v = body.subject.trim();
    if (!v) return NextResponse.json({ error: 'Subject cannot be empty' }, { status: 400 });
    patch.subject = v;
  }
  if (typeof body?.body_html === 'string') {
    const v = body.body_html.trim();
    if (!v) return NextResponse.json({ error: 'Body cannot be empty' }, { status: 400 });
    patch.body_html = v;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No changes given' }, { status: 400 });

  const { data, error } = await admin.from('mail_templates').update(patch).eq('id', id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'mail_template.updated', resource: `mail_template:${id}`, newValue: patch });
  return NextResponse.json({ template: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;

  const { error } = await admin.from('mail_templates').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'mail_template.deleted', resource: `mail_template:${id}` });
  return NextResponse.json({ success: true });
}
