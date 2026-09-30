import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES, MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { parsePostPayload } from '@/lib/web-cms/postPayload';
import { pingWebsite } from '@/lib/web-cms/revalidate';

export async function GET() {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { data, error } = await admin.from('web_posts').select('*').order('published_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const parsed = parsePostPayload(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: post, error } = await admin.from('web_posts').insert(parsed.post).select('*').single();
  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json({ error: dup ? 'That slug is already used by another post' : error.message }, { status: dup ? 409 : 500 });
  }

  if (parsed.sections.length) {
    const { error: e } = await admin.from('web_post_sections')
      .insert(parsed.sections.map((x, i) => ({ ...x, post_id: post.id, sort_order: i })));
    if (e) return NextResponse.json({ error: `Post saved, body failed: ${e.message}`, id: post.id }, { status: 500 });
  }

  await logAudit({ actorId: user.id, action: 'web_post.created', resource: `web_post:${post.id}`, newValue: { title: parsed.post.title } });
  const refreshed = await pingWebsite();
  return NextResponse.json({ post, refreshed }, { status: 201 });
}
