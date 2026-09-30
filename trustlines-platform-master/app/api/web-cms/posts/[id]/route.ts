import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES, MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { parsePostPayload } from '@/lib/web-cms/postPayload';
import { pingWebsite } from '@/lib/web-cms/revalidate';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const { data: post, error } = await admin.from('web_posts').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: sections } = await admin.from('web_post_sections').select('*').eq('post_id', id).order('sort_order');
  return NextResponse.json({ post, sections: sections ?? [] });
}

// Full save. New body blocks are inserted first, old ones removed after, so a failed insert
// never leaves the post without its body.
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;

  const parsed = parsePostPayload(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: existing } = await admin.from('web_posts').select('id').eq('id', id).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: post, error } = await admin.from('web_posts').update(parsed.post).eq('id', id).select('*').single();
  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json({ error: dup ? 'That slug is already used by another post' : error.message }, { status: dup ? 409 : 500 });
  }

  const { data: old } = await admin.from('web_post_sections').select('id').eq('post_id', id);
  const oldIds = (old ?? []).map((r: { id: string }) => r.id);
  if (parsed.sections.length) {
    const { error: e } = await admin.from('web_post_sections')
      .insert(parsed.sections.map((x, i) => ({ ...x, post_id: id, sort_order: i })));
    if (e) return NextResponse.json({ error: `Could not save the body: ${e.message}` }, { status: 500 });
  }
  if (oldIds.length) await admin.from('web_post_sections').delete().in('id', oldIds);

  await logAudit({ actorId: user.id, action: 'web_post.updated', resource: `web_post:${id}`, newValue: { title: parsed.post.title, is_published: parsed.post.is_published } });
  const refreshed = await pingWebsite();
  return NextResponse.json({ post, refreshed });
}

// Quick publish / unpublish from the list.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as { is_published?: unknown } | null;
  if (typeof b?.is_published !== 'boolean') return NextResponse.json({ error: 'No changes given' }, { status: 400 });

  const { data, error } = await admin.from('web_posts').update({ is_published: b.is_published }).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'web_post.updated', resource: `web_post:${id}`, newValue: { is_published: b.is_published } });
  const refreshed = await pingWebsite();
  return NextResponse.json({ post: data, refreshed });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const { error } = await admin.from('web_posts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'web_post.deleted', resource: `web_post:${id}` });
  const refreshed = await pingWebsite();
  return NextResponse.json({ success: true, refreshed });
}
