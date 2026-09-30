import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_MANAGE_ROLES, MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { parseProjectPayload } from '@/lib/web-cms/projectPayload';
import { pingWebsite } from '@/lib/web-cms/revalidate';

export async function GET() {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { data, error } = await admin.from('web_projects').select('*')
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return deny;

  const parsed = parseProjectPayload(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: project, error } = await admin.from('web_projects').insert(parsed.project).select('*').single();
  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json({ error: dup ? 'That slug is already used by another project' : error.message }, { status: dup ? 409 : 500 });
  }

  const pid = project.id as string;
  if (parsed.photos.length) {
    const { error: e } = await admin.from('web_project_photos')
      .insert(parsed.photos.map((x, i) => ({ ...x, project_id: pid, sort_order: i })));
    if (e) return NextResponse.json({ error: `Project saved, gallery failed: ${e.message}`, id: pid }, { status: 500 });
  }
  if (parsed.sections.length) {
    const { error: e } = await admin.from('web_project_sections')
      .insert(parsed.sections.map((x, i) => ({ ...x, project_id: pid, sort_order: i })));
    if (e) return NextResponse.json({ error: `Project saved, sections failed: ${e.message}`, id: pid }, { status: 500 });
  }

  await logAudit({ actorId: user.id, action: 'web_project.created', resource: `web_project:${pid}`, newValue: { title: parsed.project.title } });
  const refreshed = await pingWebsite();
  return NextResponse.json({ project, refreshed }, { status: 201 });
}
