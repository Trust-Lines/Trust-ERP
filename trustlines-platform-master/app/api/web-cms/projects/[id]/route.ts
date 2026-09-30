import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES, MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { parseProjectPayload } from '@/lib/web-cms/projectPayload';
import { pingWebsite } from '@/lib/web-cms/revalidate';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const { data: project, error } = await admin.from('web_projects').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [photos, sections] = await Promise.all([
    admin.from('web_project_photos').select('*').eq('project_id', id).order('sort_order'),
    admin.from('web_project_sections').select('*').eq('project_id', id).order('sort_order'),
  ]);
  return NextResponse.json({ project, photos: photos.data ?? [], sections: sections.data ?? [] });
}

// Full save: project fields + the complete ordered gallery + the complete ordered sections.
// New child rows are inserted first, old ones removed after, so a failed insert never leaves the
// project without its photos/sections.
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;

  const parsed = parseProjectPayload(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: existing } = await admin.from('web_projects').select('id').eq('id', id).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: project, error } = await admin.from('web_projects').update(parsed.project).eq('id', id).select('*').single();
  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json({ error: dup ? 'That slug is already used by another project' : error.message }, { status: dup ? 409 : 500 });
  }

  for (const [table, rows] of [
    ['web_project_photos', parsed.photos],
    ['web_project_sections', parsed.sections],
  ] as const) {
    const { data: old } = await admin.from(table).select('id').eq('project_id', id);
    const oldIds = (old ?? []).map((r: { id: string }) => r.id);
    if (rows.length) {
      const { error: e } = await admin.from(table).insert(rows.map((x, i) => ({ ...x, project_id: id, sort_order: i })));
      if (e) return NextResponse.json({ error: `Could not save ${table}: ${e.message}` }, { status: 500 });
    }
    if (oldIds.length) await admin.from(table).delete().in('id', oldIds);
  }

  await logAudit({ actorId: user.id, action: 'web_project.updated', resource: `web_project:${id}`, newValue: { title: parsed.project.title, is_published: parsed.project.is_published } });
  const refreshed = await pingWebsite();
  return NextResponse.json({ project, refreshed });
}

// Quick toggles from the list (publish / unpublish, sort order) without resending the whole project.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as { is_published?: unknown; sort_order?: unknown } | null;
  const patch: Record<string, unknown> = {};
  if (typeof b?.is_published === 'boolean') patch.is_published = b.is_published;
  if (typeof b?.sort_order === 'number' && Number.isInteger(b.sort_order)) patch.sort_order = b.sort_order;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'No changes given' }, { status: 400 });

  const { data, error } = await admin.from('web_projects').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'web_project.updated', resource: `web_project:${id}`, newValue: patch });
  const refreshed = await pingWebsite();
  return NextResponse.json({ project: data, refreshed });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const { error } = await admin.from('web_projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'web_project.deleted', resource: `web_project:${id}` });
  const refreshed = await pingWebsite();
  return NextResponse.json({ success: true, refreshed });
}
