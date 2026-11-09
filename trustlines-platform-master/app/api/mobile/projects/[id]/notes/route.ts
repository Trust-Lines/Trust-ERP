import { NextRequest, NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';
import { canAccessProject } from '@/lib/permissions/projectAccess';
import { logAudit } from '@/lib/audit/log';

// Proje notları / saha raporu (045 / 012). Internal notes (Trust Lines side) never reach tlines_pm,
// and a tlines_pm's own notes are always non-internal.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, role, admin, deny } = await requireApiPage('page.projects');
  if (deny) return deny;
  const { id } = await params;
  if (!(await canAccessProject(id, user.id, role))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  let q = admin.from('project_notes').select('id, content, is_internal, created_at, author:profiles!author_id(full_name)')
    .eq('project_id', id).order('created_at', { ascending: false }).limit(100);
  if (role === 'tlines_pm') q = q.eq('is_internal', false);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not load notes' }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, role, admin, deny } = await requireApiPage('page.projects');
  if (deny) return deny;
  const { id } = await params;
  if (!(await canAccessProject(id, user.id, role))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const b = await req.json().catch(() => null) as { content?: unknown; is_internal?: unknown } | null;
  const content = typeof b?.content === 'string' ? b.content.trim().slice(0, 4000) : '';
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });
  const isInternal = role === 'tlines_pm' ? false : b?.is_internal !== false;

  const { data, error } = await admin.from('project_notes')
    .insert({ project_id: id, author_id: user.id, content, is_internal: isInternal })
    .select('id, content, is_internal, created_at').single();
  if (error) return NextResponse.json({ error: 'Could not save the note' }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'project.note_added', projectId: id, resource: `project_note:${data.id}`, newValue: { is_internal: isInternal } });
  return NextResponse.json({ note: data });
}
