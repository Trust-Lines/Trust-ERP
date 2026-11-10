import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncProjectDropbox } from '@/lib/dropbox/autoSync';

// One project's full scan, run when its page opens (the webhook / cron keep it current otherwise).
export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { projectId } = await request.json() as { projectId: string };
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await syncProjectDropbox(createAdminClient() as any, getDropboxClient(), projectId, user.id);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ synced: r.synced });
}
