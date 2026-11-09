import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { CONTAINER_READ_ROLES } from '@/lib/logistics/containers';
import { CUSTOMER_READ_ROLES } from '@/lib/customers/roles';

// Mobile global search (049) and QR lookup (005): projects, production items (by PF code — never for
// tlines_pm), containers and customers — each only when the role may open that module, 5 hits each.
export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/[%,()]/g, ' ').slice(0, 60);
  if (q.length < 2) return NextResponse.json({ projects: [], items: [], containers: [], customers: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);
  const can = (k: string) => !!role && pageAllowed(role, perms, k);
  const like = `%${q}%`;
  const supabase = await createClient();
  const none = Promise.resolve({ data: [] });

  const [projects, items, containers, customers] = await Promise.all([
    can('page.projects')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (() => { let p = (supabase as any).from('projects').select('id, code, name, current_stage').is('deleted_at', null).or(`code.ilike.${like},name.ilike.${like}`); if (role === 'tlines_pm') p = p.eq('tlines_pm_id', user.id); return p.limit(5); })()
      : none,
    can('page.projects') && role !== 'tlines_pm'
      ? admin.from('production_items').select('id, pf_code, type, status, project_id').is('deleted_at', null).ilike('pf_code', like).limit(5)
      : none,
    can('page.logistics') && CONTAINER_READ_ROLES.includes(role ?? '')
      ? admin.from('containers').select('id, container_no, booking_no, status').is('deleted_at', null).or(`container_no.ilike.${like},booking_no.ilike.${like}`).limit(5)
      : none,
    can('page.customers') && (CUSTOMER_READ_ROLES as readonly string[]).includes(role ?? '')
      ? admin.from('customers').select('id, name, code, industry').is('deleted_at', null).ilike('name', like).limit(5)
      : none,
  ]);

  return NextResponse.json({ projects: projects.data ?? [], items: items.data ?? [], containers: containers.data ?? [], customers: customers.data ?? [] });
}
