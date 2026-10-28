import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { permCan } from '@/lib/permissions/catalog';

// Who may add / deactivate vendors: the production board (edit.production), the
// Item List generator on a project (edit.projects) and supplier admins (page.suppliers).
const VENDOR_WRITE_PERMS = ['edit.production', 'edit.projects', 'page.suppliers'];
// Reading the code + name list is also needed by anyone who sees PF / PO documents.
const VENDOR_READ_PERMS = [...VENDOR_WRITE_PERMS, 'page.production', 'view.pf', 'view.po'];

export async function requireVendorAccess(mode: 'read' | 'write'): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { user: User; admin: any; deny: null }
  | { user: null; admin: null; deny: NextResponse }
> {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, admin: null, deny: unauth as NextResponse };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);
  const needed = mode === 'write' ? VENDOR_WRITE_PERMS : VENDOR_READ_PERMS;
  if (!role || !needed.some(k => permCan(perms, k))) {
    return { user: null, admin: null, deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, admin, deny: null };
}
