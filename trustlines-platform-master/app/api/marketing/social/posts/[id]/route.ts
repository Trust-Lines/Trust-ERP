import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { parseSocialPost, SOCIAL_POST_COLS } from '@/lib/marketing/prWorkspace';
import { canDelete, dbError } from '@/lib/marketing/prWorkspaceServer';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const parsed = parseSocialPost(await req.json().catch(() => null), true);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const patch = parsed.value;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data: current, error: readError } = await admin.from('social_posts')
    .select('id, published_on, planned_on').eq('id', id).is('deleted_at', null).maybeSingle();
  if (readError) return dbError('save the post', readError);
  if (!current) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  // Marking a post published without a date: use its planned date, else today.
  if (patch.status === 'published' && !('published_on' in patch) && !current.published_on) {
    patch.published_on = patch.planned_on ?? current.planned_on ?? new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await admin.from('social_posts').update(patch).eq('id', id).select(SOCIAL_POST_COLS).single();
  if (error) return dbError('save the post', error);

  await logAudit({ actorId: user.id, action: 'social_post.updated', resource: `social_post:${id}`, newValue: patch });
  return NextResponse.json({ post: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const { data: row, error: readError } = await admin.from('social_posts')
    .select('id, title, created_by').eq('id', id).is('deleted_at', null).maybeSingle();
  if (readError) return dbError('delete the post', readError);
  if (!row) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (!canDelete(role, user.id, row.created_by)) {
    return NextResponse.json({ error: 'Only the person who added this post or a Marketing manager can delete it' }, { status: 403 });
  }

  const { error } = await admin.from('social_posts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return dbError('delete the post', error);

  await logAudit({ actorId: user.id, action: 'social_post.deleted', resource: `social_post:${id}`, newValue: { title: row.title } });
  return NextResponse.json({ ok: true });
}
