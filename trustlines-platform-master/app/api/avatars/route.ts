import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Who has a profile photo — loaded once by AvatarDirectoryProvider so every avatar in the app
// (top bar, assignees, team lists…) can show the photo instead of initials. Signed-in users only.
export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('profiles').select('id, full_name, avatar_updated_at').not('avatar_path', 'is', null);
  if (error) return NextResponse.json({ avatars: [] }); // before migration 135
  const avatars = ((data ?? []) as { id: string; full_name: string | null; avatar_updated_at: string | null }[])
    .map(p => ({ id: p.id, name: p.full_name ?? '', v: Date.parse(p.avatar_updated_at ?? '') || 0 }));
  return NextResponse.json({ avatars }, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
