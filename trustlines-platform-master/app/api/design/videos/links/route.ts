import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireDesignPage, tableMissing } from '@/lib/design/access';
import { newUploadToken } from '@/lib/design/productVideos';

const COLS = 'id, token, label, created_at';
const NOT_READY = 'Upload links are not set up yet — run migration 139_product_video_stickers_and_upload_links.sql.';

// No-login upload links for the production floor (/video-upload/<token>) — list and create.
export async function GET() {
  const { admin, deny } = await requireDesignPage('page.design_videos');
  if (deny) return deny;
  const { data, error } = await admin.from('product_video_upload_links').select(COLS).is('revoked_at', null).order('created_at', { ascending: false });
  if (error) return tableMissing(error) ? NextResponse.json({ notReady: NOT_READY, links: [] }) : NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_videos');
  if (deny) return deny;
  if (!isManager) return NextResponse.json({ error: 'Only a manager can create upload links' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as { label?: unknown };
  const label = String(body.label ?? '').trim().slice(0, 80) || 'Production floor';
  const { data, error } = await admin.from('product_video_upload_links').insert({ token: newUploadToken(), label, created_by: user.id }).select(COLS).single();
  if (error) return NextResponse.json({ error: tableMissing(error) ? NOT_READY : error.message }, { status: tableMissing(error) ? 409 : 500 });
  await logAudit({ actorId: user.id, action: 'product_video_link.created', resource: `product_video_link:${data.id}`, newValue: { label } });
  return NextResponse.json({ link: data }, { status: 201 });
}
