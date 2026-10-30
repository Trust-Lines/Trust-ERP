import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Settings → Profile: everyone edits their OWN display name. Only `full_name` is writable
// here — role, scope and org metadata stay with ops via /api/team/[id].

const MAX_NAME = 120;

export async function PATCH(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const body = await req.json().catch(() => null) as { full_name?: unknown } | null;
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ') : '';
  if (!fullName) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (fullName.length > MAX_NAME) return NextResponse.json({ error: `Name must be ${MAX_NAME} characters or fewer` }, { status: 400 });

  const admin = createAdminClient() as any;
  const { data: existing } = await admin.from('profiles').select('full_name').eq('id', user.id).single();
  const { error } = await admin.from('profiles').update({ full_name: fullName }).eq('id', user.id);
  if (error) {
    console.error('[me/profile]', error.message);
    return NextResponse.json({ error: 'Could not save your profile' }, { status: 500 });
  }

  await logAudit({
    actorId: user.id, action: 'profile.name_changed', resource: `user:${user.id}`,
    oldValue: { full_name: (existing as { full_name?: string } | null)?.full_name ?? null },
    newValue: { full_name: fullName },
  });
  return NextResponse.json({ full_name: fullName });
}
