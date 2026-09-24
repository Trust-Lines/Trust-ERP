import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';

const COLS = 'id, name, subject, body_html, created_by, created_at, updated_at';

export async function GET(_req: NextRequest) {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('mail_templates')
    .select(COLS).is('deleted_at', null).order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { name?: string; subject?: string; body_html?: string } | null;
  const name = body?.name?.trim();
  const subject = body?.subject?.trim();
  const bodyHtml = body?.body_html?.trim();
  if (!name) return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
  if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
  if (!bodyHtml) return NextResponse.json({ error: 'Body is required' }, { status: 400 });

  const { data, error } = await admin.from('mail_templates').insert({
    name, subject, body_html: bodyHtml, created_by: user.id,
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'mail_template.created', resource: `mail_template:${data.id}`, newValue: { name } });
  return NextResponse.json({ template: data }, { status: 201 });
}
