import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Mobile "Bildirim merkezi" (032): my own notifications, newest first, and marking them read.
export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('notifications')
    .select('id, project_id, type, title, body, link, is_read, created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

/** PATCH { ids: string[] } or { all: true } — only ever touches the caller's own rows. */
export async function PATCH(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const b = await req.json().catch(() => null) as { ids?: unknown; all?: unknown } | null;
  const ids = Array.isArray(b?.ids) ? (b!.ids as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
  if (!ids.length && b?.all !== true) return NextResponse.json({ error: 'ids or all required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  let q = admin.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  if (ids.length) q = q.in('id', ids);
  const { error } = await q;
  if (error) return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
