import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { PAGE_ROUTES, pageAllowed } from '@/lib/permissions/catalog';

// Who the mobile app is talking to and which pages (modules) their role may open — the app
// builds its menu and home shortcuts from `pages`. The APIs behind each module still authorize.
export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles')
    .select('id, full_name, email, role, is_active').eq('id', user.id).maybeSingle();
  if (!profile || profile.is_active === false)
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 });

  const perms = await getRolePermissions(admin, profile.role);
  const pages = PAGE_ROUTES.map(p => p.key).filter(key => pageAllowed(profile.role, perms, key));

  return NextResponse.json({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    pages,
  });
}
