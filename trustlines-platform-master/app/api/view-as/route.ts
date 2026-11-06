import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/supabase/server';
import { realRoleOf, VIEW_AS_ALLOWED, VIEW_AS_COOKIE, VIEW_AS_ROLES } from '@/lib/viewAs';
import { logAudit } from '@/lib/audit/log';

// "View as role" on/off for a General Manager. Always checks the REAL role (lib/viewAs.ts).
export async function POST(req: NextRequest) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const realRole = await realRoleOf(user.id);
  if (!realRole || !VIEW_AS_ALLOWED.includes(realRole)) return NextResponse.json({ error: 'Only a General Manager can view as another role' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { role?: string | null };
  const role = body.role ?? null;
  const res = NextResponse.json({ ok: true, role });
  if (!role || role === realRole) {
    res.cookies.set(VIEW_AS_COOKIE, '', { path: '/', maxAge: 0 });
  } else {
    if (!VIEW_AS_ROLES.includes(role)) return NextResponse.json({ error: 'Unknown role' }, { status: 400 });
    res.cookies.set(VIEW_AS_COOKIE, role, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8 });
  }
  await logAudit({ actorId: user.id, action: role ? 'view_as.started' : 'view_as.stopped', resource: `profile:${user.id}`, newValue: { role } });
  return res;
}
