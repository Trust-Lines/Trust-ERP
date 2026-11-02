import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { removeAvatar, saveAvatar } from '@/lib/profile/avatar';

// Settings → Profile photo: your own (lib/profile/avatar). Admins set anyone's on the Team page
// (app/api/team/[id]/avatar).

// multipart: file
export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const form = await req.formData().catch(() => null);
  const r = await saveAvatar(createAdminClient(), user.id, form?.get('file'));
  return 'error' in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
}

export async function DELETE() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const failed = await removeAvatar(createAdminClient(), user.id);
  return failed ? NextResponse.json(failed, { status: 500 }) : NextResponse.json({ ok: true });
}
