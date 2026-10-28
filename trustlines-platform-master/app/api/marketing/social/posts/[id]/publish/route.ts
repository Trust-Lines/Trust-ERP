import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { publishPost, PublishError } from '@/lib/social/service';

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

// "Publish now": posts it to the platform immediately.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  try {
    const result = await publishPost(admin, id);
    await logAudit({ actorId: user.id, action: result.ok ? 'social_post.published' : 'social_post.publish_failed', resource: `social_post:${id}`, newValue: result });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PublishError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[social publish]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not publish the post' }, { status: 500 });
  }
}
