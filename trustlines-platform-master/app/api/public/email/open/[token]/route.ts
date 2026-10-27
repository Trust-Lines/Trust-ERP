import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordOpen } from '@/lib/email/tracking';

type Params = { params: Promise<{ token: string }> };

// 1×1 transparent GIF.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Open-tracking pixel. Always answers with the image — a tracking failure must never show a broken image.
export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    await recordOpen(createAdminClient(), token, req.headers.get('user-agent'));
  } catch (e) {
    console.error('[email open]', e instanceof Error ? e.message : e);
  }
  return new NextResponse(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, private', 'Content-Length': String(PIXEL.length) },
  });
}
