import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { parseSocialPost, SOCIAL_POST_COLS } from '@/lib/marketing/prWorkspace';
import { dbError } from '@/lib/marketing/prWorkspaceServer';

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const parsed = parseSocialPost(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const post = parsed.value;
  if (post.status === 'published' && !post.published_on) post.published_on = new Date().toISOString().slice(0, 10);

  const { data, error } = await admin.from('social_posts')
    .insert({ ...post, created_by: user.id }).select(SOCIAL_POST_COLS).single();
  if (error) return dbError('add the post', error);

  await logAudit({ actorId: user.id, action: 'social_post.created', resource: `social_post:${data.id}`, newValue: { title: data.title, status: data.status } });
  return NextResponse.json({ post: data }, { status: 201 });
}
