import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireDesignPage } from '@/lib/design/access';

// Revoke a no-login upload link: /video-upload/<token> stops working at once.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_videos');
  if (deny) return deny;
  if (!isManager) return NextResponse.json({ error: 'Only a manager can revoke upload links' }, { status: 403 });
  const { error } = await admin.from('product_video_upload_links').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'product_video_link.revoked', resource: `product_video_link:${id}` });
  return NextResponse.json({ ok: true });
}
